"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Camera,
  Award,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  previewSeasonClosure,
  snapshotSeason,
  awardSeasonRankBadges,
  resetSeason,
  getSeasonClosureLog,
  type SeasonClosurePreview,
  type SeasonClosureLog,
  type SeasonClosureStep,
} from "@/lib/services/seasonService";
import { useToast } from "@/components/ui/use-toast";

const RANK_ORDER = [
  "Écuyer",
  "Soldat",
  "Sergent",
  "Capitaine",
  "Chevalier",
  "Chevalier de la Table Ronde",
];

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function StepBadge({ done }: { done: boolean }) {
  return done ? (
    <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Fait</Badge>
  ) : (
    <Badge variant="outline">En attente</Badge>
  );
}

export default function SeasonClosurePage() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, i) => currentYear - 1 + i),
    [currentYear]
  );

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [preview, setPreview] = useState<SeasonClosurePreview | null>(null);
  const [logs, setLogs] = useState<SeasonClosureLog[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pendingStep, setPendingStep] = useState<SeasonClosureStep | null>(null);
  const [confirmStep, setConfirmStep] = useState<SeasonClosureStep | null>(null);

  const refresh = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const [p, l] = await Promise.all([
        previewSeasonClosure(selectedYear),
        getSeasonClosureLog(selectedYear),
      ]);
      setPreview(p);
      setLogs(l);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Chargement impossible",
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedYear, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runStep = async (step: SeasonClosureStep) => {
    setPendingStep(step);
    try {
      const fn =
        step === "snapshot" ? snapshotSeason
        : step === "award_badges" ? awardSeasonRankBadges
        : resetSeason;
      const result = await fn(selectedYear);
      const stepLabel =
        step === "snapshot" ? "Snapshot"
        : step === "award_badges" ? "Distribution des badges"
        : "Reset";
      if (result.skipped) {
        toast({ title: `${stepLabel} déjà exécuté`, description: result.reason ?? "Idempotence : aucune action" });
      } else {
        const count =
          step === "snapshot" ? result.snapshotted
          : step === "award_badges" ? result.badges_awarded
          : result.profiles_reset;
        toast({
          title: `${stepLabel} terminé`,
          description: `${count ?? 0} ligne(s) traitée(s) en ${result.duration_ms ?? 0} ms`,
        });
      }
      await refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Échec de l'étape",
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setPendingStep(null);
      setConfirmStep(null);
    }
  };

  const snapshotDone = preview?.snapshot_done ?? false;
  const badgesDone = preview?.badges_done ?? false;
  const resetDone = preview?.reset_done ?? false;

  const distribution = preview?.rank_distribution ?? {};
  const sortedRanks = RANK_ORDER.filter((r) => distribution[r] !== undefined);
  const otherRanks = Object.keys(distribution).filter((r) => !RANK_ORDER.includes(r));

  const stepConfig = {
    snapshot: {
      title: "Snapshot des rangs",
      description: "Fige le rang max de chaque Compagnon dans season_snapshots. Étape 1/3.",
      confirmDescription: `Cette action va figer ${preview?.total_profiles ?? 0} profil(s) pour la saison ${selectedYear}. Réversible uniquement par suppression manuelle.`,
      icon: Camera,
      enabled: !snapshotDone,
      done: snapshotDone,
    },
    award_badges: {
      title: "Distribuer les badges",
      description: "Attribue les 6 badges « mémoire de saison » selon le rang figé. Étape 2/3.",
      confirmDescription: `Les badges seront attribués aux ${preview?.total_profiles ?? 0} profil(s) snapshottés pour la saison ${selectedYear}.`,
      icon: Award,
      enabled: snapshotDone && !badgesDone,
      done: badgesDone,
    },
    reset: {
      title: "Reset de la saison",
      description: "Ramène cashback_coefficient à 1,0 pour tous les profils. Les PdB et badges sont conservés. Étape 3/3.",
      confirmDescription: `Tous les coefficients cashback vont être ramenés à 1,0. Les Paraiges de Bronze déjà gagnées et les badges sont préservés. La nouvelle saison redémarre.`,
      icon: RotateCcw,
      enabled: badgesDone && !resetDone,
      done: resetDone,
    },
  } as const;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/rewards" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux récompenses
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarClock className="h-7 w-7" /> Clôture de saison
          </h1>
          <p className="text-muted-foreground mt-1">
            Snapshot des rangs, distribution des badges « mémoire de saison », puis reset des coefficients.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label htmlFor="year">Saison</Label>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger id="year" className="w-[120px] mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loadingPreview}>
            {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Aperçu (dry-run) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Profils concernés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{preview?.total_profiles ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Tous les Compagnons (role = client)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">PdB déjà gagnées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{preview ? formatEur(preview.total_pdb_earned_cents) : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Conservées au reset (sans expiration)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">État de la clôture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Snapshot</span><StepBadge done={snapshotDone} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Badges</span><StepBadge done={badgesDone} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Reset</span><StepBadge done={resetDone} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution des rangs */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution prévisionnelle des rangs</CardTitle>
          <CardDescription>
            Si le snapshot était lancé maintenant, voici comment les Compagnons seraient figés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rang</TableHead>
                <TableHead className="text-right">Compagnons</TableHead>
                <TableHead className="text-right">Part</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...sortedRanks, ...otherRanks].map((rank) => {
                const count = distribution[rank] ?? 0;
                const total = preview?.total_profiles ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <TableRow key={rank}>
                    <TableCell className="font-medium">{rank}</TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedRanks.length === 0 && otherRanks.length === 0 && !loadingPreview && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Aucune donnée pour {selectedYear}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Étapes de clôture</CardTitle>
          <CardDescription>
            Chaque étape est idempotente et a une garde sur la précédente. À lancer dans l’ordre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(stepConfig) as SeasonClosureStep[]).map((step) => {
            const cfg = stepConfig[step];
            const Icon = cfg.icon;
            return (
              <div key={step} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-1 h-5 w-5 ${cfg.done ? "text-green-600" : "text-muted-foreground"}`} />
                  <div>
                    <div className="font-medium">{cfg.title}</div>
                    <div className="text-sm text-muted-foreground">{cfg.description}</div>
                  </div>
                </div>
                <Button
                  variant={cfg.done ? "outline" : "default"}
                  disabled={!cfg.enabled || pendingStep !== null}
                  onClick={() => setConfirmStep(step)}
                >
                  {pendingStep === step && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {cfg.done ? "Déjà fait" : `Lancer`}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Journal d’exécution — saison {selectedYear}</CardTitle>
          <CardDescription>Historique des étapes lancées (manuel, cron, fallback).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étape</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Lignes</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Aucune étape exécutée pour {selectedYear}</TableCell>
                </TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={`${l.year}-${l.step}-${l.executed_at}`}>
                    <TableCell className="font-medium">{l.step}</TableCell>
                    <TableCell><Badge variant="outline">{l.source}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(l.executed_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.affected_rows ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.duration_ms ? `${l.duration_ms} ms` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{l.notes ?? ""}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de confirmation */}
      <AlertDialog open={confirmStep !== null} onOpenChange={(o) => !o && setConfirmStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmer : {confirmStep ? stepConfig[confirmStep].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStep ? stepConfig[confirmStep].confirmDescription : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingStep !== null}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmStep && runStep(confirmStep)}
              disabled={pendingStep !== null}
            >
              {pendingStep !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
