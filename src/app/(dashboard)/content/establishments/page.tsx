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
import { Loader2, Building2, MapPin } from "lucide-react";
import {
  getEstablishments,
  getBeersByEstablishment,
  getImageUrl,
  type Establishment,
} from "@/lib/services/contentService";
import { getReceiptsByEstablishment } from "@/lib/services/receiptService";
import { establishmentKeys } from "@/lib/queries/keys";
import { formatCurrency } from "@/lib/utils";

type EstablishmentWithStats = Establishment & {
  receiptCount?: number;
  totalRevenue?: number;
};

type BeerLite = {
  id: number;
  title: string;
  ibu?: number | null;
  breweries?: { title: string } | null;
};

export default function EstablishmentsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] =
    useState<EstablishmentWithStats | null>(null);

  const {
    data: establishments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: establishmentKeys.lists(),
    queryFn: async (): Promise<EstablishmentWithStats[]> => {
      const [estData, receiptsData] = await Promise.all([
        getEstablishments(),
        getReceiptsByEstablishment(),
      ]);
      const receiptsMap = new Map(
        receiptsData.map((r) => [r.establishmentId, r]),
      );
      return estData.map((est) => {
        const info = receiptsMap.get(est.id);
        return {
          ...est,
          receiptCount: info?.count || 0,
          totalRevenue: info?.total || 0,
        };
      });
    },
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      toast.error("Impossible de charger les établissements");
    }
  }, [error]);

  const { data: beersForEstablishment = [], isLoading: loadingBeers } =
    useQuery({
      queryKey: selectedEstablishment
        ? establishmentKeys.beers(selectedEstablishment.id)
        : ["establishments", "beers", "none"],
      queryFn: () =>
        getBeersByEstablishment(selectedEstablishment!.id) as Promise<
          BeerLite[]
        >,
      enabled: !!selectedEstablishment,
    });

  const filteredEstablishments = useMemo(() => {
    return establishments.filter(
      (est) =>
        searchTerm.length < 3 ||
        est.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.city?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [establishments, searchTerm]);

  const totalRevenue = useMemo(
    () =>
      establishments.reduce((sum, est) => sum + (est.totalRevenue || 0), 0),
    [establishments],
  );

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Établissements</h1>
        <p className="text-muted-foreground">
          Données des établissements (lecture seule).
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Vue d&apos;ensemble
            </h2>
            <div className="space-y-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Total établissements
                  </CardTitle>
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-xl font-bold">{establishments.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    CA total
                  </CardTitle>
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Recherche
            </h2>
            <Input
              placeholder="Nom, ville…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </section>
        </aside>

        <Card className="flex min-h-0 flex-1 flex-col md:h-full md:overflow-hidden">
          <CardHeader>
            <CardTitle>Liste des établissements</CardTitle>
            <CardDescription>
              {filteredEstablishments.length} établissement
              {filteredEstablishments.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEstablishments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Aucun établissement trouvé.
              </div>
            ) : (
              <div className="min-h-0 flex-1 md:overflow-y-auto">
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
                    onClick={() =>
                      router.push(
                        `/content/establishments/${establishment.id}`,
                      )
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {establishment.logo && (
                          <Image
                            src={
                              getImageUrl(establishment.logo, {
                                width: 40,
                                height: 40,
                              }) || ""
                            }
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
                          <p className="text-sm">
                            {establishment.line_address_1}
                          </p>
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
                          setSelectedEstablishment(establishment);
                        }}
                      >
                        Voir les bières
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
        open={!!selectedEstablishment}
        onOpenChange={(open) => !open && setSelectedEstablishment(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Bières disponibles — {selectedEstablishment?.title}
            </DialogTitle>
            <DialogDescription>
              Liste des bières configurées pour cet établissement.
            </DialogDescription>
          </DialogHeader>
          {loadingBeers ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : beersForEstablishment.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune bière configurée pour cet établissement.
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
                  {beersForEstablishment.map((beer) => (
                    <TableRow key={beer.id}>
                      <TableCell className="font-medium">{beer.title}</TableCell>
                      <TableCell>{beer.breweries?.title || "-"}</TableCell>
                      <TableCell>
                        {beer.ibu ? (
                          <Badge variant="outline">{beer.ibu}</Badge>
                        ) : (
                          "-"
                        )}
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
