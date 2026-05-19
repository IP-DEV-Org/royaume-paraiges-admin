"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Eye, PlayCircle, CheckCircle } from "lucide-react";
import {
  getDistributionPreview,
  distributeRewards,
} from "@/lib/services/rewardService";
import { getPeriodIdentifier, formatCurrency, formatPercentage } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { PeriodType } from "@/types/database";

interface PreviewItem {
  rank: number;
  customer_id: string;
  xp: number;
  tier_name: string;
  coupon_amount: number | null;
  coupon_percentage: number | null;
  badge_type_id: number | null;
}

interface CustomerInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export default function DistributePage() {
  const { toast } = useToast();

  const [periodType, setPeriodType] = useState<PeriodType>("weekly");
  const [periodIdentifier, setPeriodIdentifier] = useState("");
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [customers, setCustomers] = useState<Record<string, CustomerInfo>>({});
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [distributed, setDistributed] = useState(false);

  // Generate period identifier suggestions
  const getPeriodSuggestions = (type: PeriodType) => {
    const now = new Date();
    const suggestions: string[] = [];

    if (type === "weekly") {
      for (let i = 0; i < 4; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        suggestions.push(getPeriodIdentifier("weekly", date));
      }
    } else if (type === "monthly") {
      for (let i = 0; i < 3; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        suggestions.push(getPeriodIdentifier("monthly", date));
      }
    } else {
      suggestions.push(now.getFullYear().toString());
      suggestions.push((now.getFullYear() - 1).toString());
    }

    return suggestions;
  };

  const handlePreview = async () => {
    if (!periodIdentifier) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Sélectionnez une periode",
      });
      return;
    }

    setLoading(true);
    setPreview([]);
    setCustomers({});
    setDistributed(false);

    try {
      const result = (await getDistributionPreview(periodType, periodIdentifier)) as {
        success?: boolean;
        error?: string;
        data?: PreviewItem[];
      };

      if (result?.success === false) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: result.error || "La prévisualisation a échoué",
        });
        return;
      }

      const items = result?.data || [];
      setPreview(items);

      if (items.length > 0) {
        const supabase = createClient();
        const ids = items.map((item) => item.customer_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", ids);

        const map: Record<string, CustomerInfo> = {};
        (profiles || []).forEach((p) => {
          map[p.id] = p as CustomerInfo;
        });
        setCustomers(map);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer la previsualisation",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async () => {
    setDistributing(true);

    try {
      const result = await distributeRewards(
        periodType,
        periodIdentifier
      );

      toast({
        title: "Distribution effectuée",
        description: `${(result as { distributed_count: number })?.distributed_count || 0} coupons distribues`,
      });
      setDistributed(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la distribution",
      });
    } finally {
      setDistributing(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rewards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Distribuér les récompenses</h1>
          <p className="text-muted-foreground">
            Prévisualiser et distribuer les récompenses du leaderboard
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélection de la periode</CardTitle>
          <CardDescription>
            Choisissez la periode pour laquelle distribuer les récompenses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Type de periode</Label>
              <Select
                value={periodType}
                onValueChange={(value: PeriodType) => {
                  setPeriodType(value);
                  setPeriodIdentifier("");
                  setPreview([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="yearly">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Periode</Label>
              <Select
                value={periodIdentifier}
                onValueChange={(value) => {
                  setPeriodIdentifier(value);
                  setPreview([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une periode" />
                </SelectTrigger>
                <SelectContent>
                  {getPeriodSuggestions(periodType).map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePreview}
                disabled={loading || !periodIdentifier}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Prévisualiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Prévisualisation</CardTitle>
              <CardDescription>
                {preview.length} utilisateur{preview.length > 1 ? "s" : ""}{" "}
                recevront des récompenses
              </CardDescription>
            </div>
            {!distributed && (
              <Button onClick={() => setShowConfirm(true)} disabled={distributing}>
                {distributing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Distribuér
              </Button>
            )}
            {distributed && (
              <Badge variant="success" className="text-base py-2 px-4">
                <CheckCircle className="mr-2 h-4 w-4" />
                Distribué
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rang</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Palier</TableHead>
                  <TableHead>Recompense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((item) => {
                  const customer = customers[item.customer_id];
                  const customerName =
                    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
                    customer?.email ||
                    item.customer_id.slice(0, 8) + "…";
                  return (
                  <TableRow key={item.customer_id}>
                    <TableCell>
                      <Badge
                        variant={item.rank <= 3 ? "default" : "secondary"}
                      >
                        #{item.rank}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customerName}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer?.email || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.xp?.toLocaleString()} XP</TableCell>
                    <TableCell>{item.tier_name}</TableCell>
                    <TableCell>
                      {item.coupon_amount ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Bonus CB: {formatCurrency(item.coupon_amount)}
                        </Badge>
                      ) : item.coupon_percentage ? (
                        <Badge variant="secondary">
                          Coupon: {item.coupon_percentage}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la distribution</AlertDialogTitle>
            <AlertDialogDescription>
              Vous etes sur le point de distribuer les récompenses pour la
              periode {periodIdentifier}. Cette action creditera les bonus
              cashback et attribuera les coupons pour {preview.length}{" "}
              utilisateur{preview.length > 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDistribute}>
              Distribuér
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
