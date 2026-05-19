"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Beer, Building2, Factory } from "lucide-react";
import {
  getBeers,
  getBreweries,
  getEstablishmentsByBeer,
  getImageUrl,
  type Beer as BeerType,
} from "@/lib/services/contentService";
import { beerKeys, breweryKeys } from "@/lib/queries/keys";

export default function BeersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [breweryFilter, setBreweryFilter] = useState<string>("all");
  const [selectedBeer, setSelectedBeer] = useState<BeerType | null>(null);

  const {
    data: beers = [],
    isLoading: beersLoading,
    error: beersError,
  } = useQuery({
    queryKey: beerKeys.lists(),
    queryFn: getBeers,
  });

  const { data: breweries = [] } = useQuery({
    queryKey: breweryKeys.lists(),
    queryFn: getBreweries,
  });

  useEffect(() => {
    if (beersError) {
      console.error(beersError);
      toast.error("Impossible de charger les bières");
    }
  }, [beersError]);

  const {
    data: establishmentsForBeer = [],
    isLoading: loadingEstablishments,
  } = useQuery({
    queryKey: selectedBeer
      ? beerKeys.establishments(selectedBeer.id)
      : ["beers", "establishments", "none"],
    queryFn: () => getEstablishmentsByBeer(selectedBeer!.id),
    enabled: !!selectedBeer,
  });

  const filteredBeers = useMemo(() => {
    return beers.filter((beer) => {
      const matchesSearch =
        searchTerm.length < 3 ||
        beer.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBrewery =
        breweryFilter === "all" ||
        beer.brewery_id?.toString() === breweryFilter;
      return matchesSearch && matchesBrewery;
    });
  }, [beers, searchTerm, breweryFilter]);

  const getBreweryName = (beer: BeerType) => {
    if (beer.breweries) return beer.breweries.title;
    const brewery = breweries.find((b) => b.id === beer.brewery_id);
    return brewery?.title || "-";
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Bières</h1>
        <p className="text-muted-foreground">
          Catalogue des bières (lecture seule).
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Catalogue
            </h2>
            <div className="space-y-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Total bières
                  </CardTitle>
                  <Beer className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-xl font-bold">{beers.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Brasseries
                  </CardTitle>
                  <Factory className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-xl font-bold">{breweries.length}</div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Filtres
            </h2>
            <div className="space-y-3">
              <Input
                placeholder="Rechercher une bière..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              <Select value={breweryFilter} onValueChange={setBreweryFilter}>
                <SelectTrigger className="w-full">
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
          </section>
        </aside>

        <Card className="flex min-h-0 flex-1 flex-col md:h-full md:overflow-hidden">
          <CardHeader>
            <CardTitle>Liste des bières</CardTitle>
            <CardDescription>
              {filteredBeers.length} bière{filteredBeers.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
            {beersLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBeers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Aucune bière trouvée.
              </div>
            ) : (
              <div className="min-h-0 flex-1 md:overflow-y-auto">
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
                            src={
                              getImageUrl(beer.featured_image, {
                                width: 40,
                                height: 40,
                              }) || ""
                            }
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
                            {beer.description &&
                              beer.description.length > 50 &&
                              "..."}
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
                          setSelectedBeer(beer);
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selectedBeer}
        onOpenChange={(open) => !open && setSelectedBeer(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Disponibilité — {selectedBeer?.title}</DialogTitle>
            <DialogDescription>
              Établissements où cette bière est disponible.
            </DialogDescription>
          </DialogHeader>
          {loadingEstablishments ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : establishmentsForBeer.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Cette bière n&apos;est configurée dans aucun établissement.
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
                  {establishmentsForBeer.map((est) => (
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
