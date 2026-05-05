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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Building2, MapPin, Search, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getEstablishments,
  getBeersByEstablishment,
  getImageUrl,
  type Establishment,
} from "@/lib/services/contentService";
import { getReceiptsByEstablishment } from "@/lib/services/receiptService";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EstablishmentWithStats extends Establishment {
  beerCount?: number;
  receiptCount?: number;
  totalRevenue?: number;
}

export default function EstablishmentsPage() {
  const [establishments, setEstablishments] = useState<EstablishmentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithStats | null>(null);
  const [selectedBeers, setSelectedBeers] = useState<any[]>([]);
  const [loadingBeers, setLoadingBeers] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [establishmentsData, receiptsData] = await Promise.all([
        getEstablishments(),
        getReceiptsByEstablishment(),
      ]);

      const receiptsMap = new Map(
        receiptsData.map((r) => [r.establishmentId, r])
      );

      const enrichedEstablishments = establishmentsData.map((est) => {
        const receiptInfo = receiptsMap.get(est.id);
        return {
          ...est,
          receiptCount: receiptInfo?.count || 0,
          totalRevenue: receiptInfo?.total || 0,
        };
      });

      setEstablishments(enrichedEstablishments);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les établissements",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewBeers = async (establishment: EstablishmentWithStats) => {
    setSelectedEstablishment(establishment);
    setLoadingBeers(true);
    try {
      const beers = await getBeersByEstablishment(establishment.id);
      setSelectedBeers(beers);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les bières",
      });
    } finally {
      setLoadingBeers(false);
    }
  };

  const filteredEstablishments = establishments.filter(
    (est) =>
      searchTerm.length < 3 ||
      est.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEstablishments = establishments.length;
  const totalRevenue = establishments.reduce(
    (sum, est) => sum + (est.totalRevenue || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Établissements</h1>
        <p className="text-muted-foreground">
          Données des établissements (lecture seule)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total établissements
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstablishments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
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
              <CardTitle>Liste des établissements</CardTitle>
              <CardDescription>
                {filteredEstablishments.length} établissement
                {filteredEstablishments.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[250px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEstablishments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun établissement trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstablishments.map((establishment) => (
                  <TableRow
                    key={establishment.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/content/establishments/${establishment.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {establishment.logo && (
                          <Image
                            src={getImageUrl(establishment.logo, {
                              width: 40,
                              height: 40,
                            }) || ""}
                            alt={establishment.title}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{establishment.title}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {establishment.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{establishment.line_address_1}</p>
                          <p className="text-xs text-muted-foreground">
                            {establishment.zipcode} {establishment.city}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {establishment.receiptCount || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {formatCurrency(establishment.totalRevenue || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewBeers(establishment);
                        }}
                      >
                        Voir les bières
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedEstablishment}
        onOpenChange={() => setSelectedEstablishment(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Bières disponibles - {selectedEstablishment?.title}
            </DialogTitle>
            <DialogDescription>
              Liste des bières configurées pour cet établissement
            </DialogDescription>
          </DialogHeader>
          {loadingBeers ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedBeers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune bière configurée pour cet établissement
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bière</TableHead>
                    <TableHead>Brasserie</TableHead>
                    <TableHead>IBU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBeers.map((beer) => (
                    <TableRow key={beer.id}>
                      <TableCell className="font-medium">{beer.title}</TableCell>
                      <TableCell>
                        {beer.breweries?.title || "-"}
                      </TableCell>
                      <TableCell>
                        {beer.ibu ? <Badge variant="outline">{beer.ibu}</Badge> : "-"}
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
