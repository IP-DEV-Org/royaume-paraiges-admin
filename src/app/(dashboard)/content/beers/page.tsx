"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Beer, ExternalLink, Building2, Factory } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getBeers,
  getBreweries,
  getEstablishmentsByBeer,
  getImageUrl,
  type Beer as BeerType,
  type Brewery,
  type Establishment,
} from "@/lib/services/contentService";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BeersPage() {
  const [beers, setBeers] = useState<BeerType[]>([]);
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [breweryFilter, setBreweryFilter] = useState<string>("all");
  const [selectedBeer, setSelectedBeer] = useState<BeerType | null>(null);
  const [selectedEstablishments, setSelectedEstablishments] = useState<Establishment[]>([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [beersData, breweriesData] = await Promise.all([
        getBeers(),
        getBreweries(),
      ]);
      setBeers(beersData);
      setBreweries(breweriesData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les bières",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewEstablishments = async (beer: BeerType) => {
    setSelectedBeer(beer);
    setLoadingEstablishments(true);
    try {
      const establishments = await getEstablishmentsByBeer(beer.id);
      setSelectedEstablishments(establishments);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les établissements",
      });
    } finally {
      setLoadingEstablishments(false);
    }
  };

  const getBreweryName = (beer: BeerType) => {
    // Nouvelle structure Supabase: breweries est la relation chargée
    if (beer.breweries) {
      return beer.breweries.title;
    }
    // Fallback: chercher par brewery_id
    const brewery = breweries.find((b) => b.id === beer.brewery_id);
    return brewery?.title || "-";
  };

  const getBreweryId = (beer: BeerType): number | undefined => {
    return beer.brewery_id ?? undefined;
  };

  const filteredBeers = beers.filter((beer) => {
    const matchesSearch = searchTerm.length < 3 || beer.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrewery =
      breweryFilter === "all" || getBreweryId(beer)?.toString() === breweryFilter;
    return matchesSearch && matchesBrewery;
  });

  const totalBeers = beers.length;
  const totalBreweries = breweries.length;
  const averageIBU =
    beers.filter((b) => b.ibu).reduce((sum, b) => sum + (b.ibu || 0), 0) /
    (beers.filter((b) => b.ibu).length || 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bières</h1>
        <p className="text-muted-foreground">
          Catalogue des bières (lecture seule)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total bières</CardTitle>
            <Beer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBeers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Brasseries</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBreweries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IBU moyen</CardTitle>
            <Beer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageIBU)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Source</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              Supabase
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="hidden sm:block">
              <CardTitle>Liste des bières</CardTitle>
              <CardDescription>
                {filteredBeers.length} bière{filteredBeers.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex flex-1 gap-2 sm:flex-none">
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-w-0 flex-1 sm:w-[200px] sm:flex-none"
              />
              <Select value={breweryFilter} onValueChange={setBreweryFilter}>
                <SelectTrigger className="w-[130px] shrink-0 sm:w-[200px]">
                  <SelectValue placeholder="Brasserie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les brasseries</SelectItem>
                  {breweries.map((brewery) => (
                    <SelectItem key={brewery.id} value={brewery.id.toString()}>
                      {brewery.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBeers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune bière trouvée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bière</TableHead>
                  <TableHead>Brasserie</TableHead>
                  <TableHead>IBU</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBeers.map((beer) => (
                  <TableRow
                    key={beer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/content/beers/${beer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {beer.featured_image && (
                          <Image
                            src={getImageUrl(beer.featured_image, {
                              width: 40,
                              height: 40,
                            }) || ""}
                            alt={beer.title}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{beer.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {beer.description?.slice(0, 50)}
                            {beer.description && beer.description.length > 50 && "..."}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getBreweryName(beer)}</TableCell>
                    <TableCell>
                      {beer.ibu ? (
                        <Badge variant="outline">{beer.ibu} IBU</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEstablishments(beer);
                        }}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        Disponibilité
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedBeer} onOpenChange={() => setSelectedBeer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Disponibilité - {selectedBeer?.title}</DialogTitle>
            <DialogDescription>
              Établissements où cette bière est disponible
            </DialogDescription>
          </DialogHeader>
          {loadingEstablishments ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedEstablishments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Cette bière n’est configurée dans aucun établissement
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Ville</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEstablishments.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium">{est.title}</TableCell>
                      <TableCell>
                        {est.city}, {est.country}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
