"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Plus,
  Trash2,
  Users,
  Watch,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getHealthStats30d,
  getClockDrift,
  getWindowFeedback,
  listEmployeeMappings,
  listEmployeeCandidates,
  listCashpadUsersForInstallation,
  createEmployeeMapping,
  deleteEmployeeMapping,
  type ClockDrift,
  type WindowFeedback,
  type EmployeeMappingWithProfile,
  type EmployeeProfile,
  type CashpadUserSeen,
} from "@/lib/services/reconciliationHealthService";

const healthKeys = {
  stats30d: ["reconciliation-health", "stats30d"] as const,
  drift: ["reconciliation-health", "drift"] as const,
  feedback: ["reconciliation-health", "feedback"] as const,
  mappings: ["reconciliation-health", "mappings"] as const,
  candidates: ["reconciliation-health", "candidates"] as const,
  cashpadUsers: (installationId: string) =>
    ["reconciliation-health", "cashpad-users", installationId] as const,
};

const DRIFT_ALERT_SECONDS = 30;
const ORPHAN_RATE_ALERT_PCT = 30;
const FEEDBACK_OOW_ALERT = 3;

function pctColor(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function MappingDialog({
  installationId,
  establishmentTitle,
  open,
  onClose,
}: {
  installationId: string;
  establishmentTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedCashpadUser, setSelectedCashpadUser] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const cashpadUsersQuery = useQuery({
    queryKey: healthKeys.cashpadUsers(installationId),
    queryFn: () => listCashpadUsersForInstallation(installationId),
    enabled: open,
  });

  const candidatesQuery = useQuery({
    queryKey: healthKeys.candidates,
    queryFn: listEmployeeCandidates,
    enabled: open,
  });

  const cashpadUser = useMemo(
    () => cashpadUsersQuery.data?.find((u) => u.cashpad_user_id === selectedCashpadUser),
    [cashpadUsersQuery.data, selectedCashpadUser],
  );

  const createMut = useMutation({
    mutationFn: () =>
      createEmployeeMapping({
        profileId: selectedProfile!,
        installationId,
        cashpadUserId: selectedCashpadUser!,
        cashpadUserName: cashpadUser?.cashpad_user_name ?? null,
      }),
    onSuccess: () => {
      toast.success("Mapping créé");
      qc.invalidateQueries({ queryKey: healthKeys.mappings });
      setSelectedCashpadUser(null);
      setSelectedProfile(null);
      onClose();
    },
    onError: (err: Error) => {
      toast.error("Erreur création mapping", { description: err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mapper un serveur — {establishmentTitle}</DialogTitle>
          <DialogDescription>
            Associe un utilisateur Cashpad observé sur cet établissement à un profil Royaume.
            Sert au départage automatique des matchs ambigus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Utilisateur Cashpad
            </label>
            <Select
              value={selectedCashpadUser ?? ""}
              onValueChange={setSelectedCashpadUser}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {(cashpadUsersQuery.data ?? []).map((u: CashpadUserSeen) => (
                  <SelectItem key={u.cashpad_user_id} value={u.cashpad_user_id}>
                    {u.cashpad_user_name ?? u.cashpad_user_id.slice(0, 8)} · {u.n_tickets} tickets
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Profil Royaume
            </label>
            <Select value={selectedProfile ?? ""} onValueChange={setSelectedProfile}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {(candidatesQuery.data ?? []).map((p: EmployeeProfile) => (
                  <SelectItem key={p.id} value={p.id}>
                    {`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
                      p.email ||
                      p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!selectedCashpadUser || !selectedProfile || createMut.isPending}
          >
            {createMut.isPending ? "Création…" : "Créer le mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReconciliationHealthPage() {
  const qc = useQueryClient();
  const [openMappingFor, setOpenMappingFor] = useState<
    | { installationId: string; title: string }
    | null
  >(null);

  const statsQuery = useQuery({ queryKey: healthKeys.stats30d, queryFn: getHealthStats30d });
  const driftQuery = useQuery({ queryKey: healthKeys.drift, queryFn: getClockDrift });
  const feedbackQuery = useQuery({ queryKey: healthKeys.feedback, queryFn: getWindowFeedback });
  const mappingsQuery = useQuery({ queryKey: healthKeys.mappings, queryFn: listEmployeeMappings });

  const deleteMut = useMutation({
    mutationFn: deleteEmployeeMapping,
    onSuccess: () => {
      toast.success("Mapping supprimé");
      qc.invalidateQueries({ queryKey: healthKeys.mappings });
    },
    onError: (err: Error) => {
      toast.error("Erreur suppression", { description: err.message });
    },
  });

  const driftByEtab = useMemo(() => {
    const m = new Map<number, ClockDrift>();
    for (const d of driftQuery.data ?? []) m.set(d.establishment_id, d);
    return m;
  }, [driftQuery.data]);

  const feedbackByEtab = useMemo(() => {
    const m = new Map<number, WindowFeedback>();
    for (const f of feedbackQuery.data ?? []) m.set(f.establishment_id, f);
    return m;
  }, [feedbackQuery.data]);

  const alerts = useMemo(() => {
    const items: Array<{ severity: "warn" | "info"; title: string; detail: string }> = [];
    for (const s of statsQuery.data ?? []) {
      const drift = driftByEtab.get(s.establishment_id);
      const feedback = feedbackByEtab.get(s.establishment_id);
      if (drift && drift.drift_s !== null && Math.abs(drift.drift_s) > DRIFT_ALERT_SECONDS) {
        items.push({
          severity: "warn",
          title: `${s.establishment_title} — dérive d'horloge POS`,
          detail: `Médiane Δt 7j = ${drift.median_7d_s}s, 30j = ${drift.median_30d_s}s (dérive ${drift.drift_s > 0 ? "+" : ""}${drift.drift_s}s). Vérifier le NTP du POS.`,
        });
      }
      if (
        s.match_rate_pct !== null &&
        s.match_rate_pct < 100 - ORPHAN_RATE_ALERT_PCT &&
        s.n_total > 5
      ) {
        items.push({
          severity: "warn",
          title: `${s.establishment_title} — taux d'orphans élevé`,
          detail: `Match rate ${s.match_rate_pct}% sur 30j (${s.n_orphan} orphans / ${s.n_matched + s.n_ambiguous + s.n_orphan} attempts).`,
        });
      }
      if (feedback && feedback.manual_links_out_of_window >= FEEDBACK_OOW_ALERT) {
        items.push({
          severity: "info",
          title: `${s.establishment_title} — liens manuels hors fenêtre`,
          detail: `${feedback.manual_links_out_of_window} liens manuels au-delà de ±${feedback.current_window_s}s. Fenêtre p95 suggérée : ${feedback.suggested_window_p95}s.`,
        });
      }
      if (
        s.n_orphan_cancelled_match !== null &&
        s.n_orphan_cancelled_match > 0
      ) {
        items.push({
          severity: "warn",
          title: `${s.establishment_title} — scans sur tickets annulés`,
          detail: `${s.n_orphan_cancelled_match} orphan(s) auraient matché un ticket Cashpad annulé.`,
        });
      }
    }
    return items;
  }, [statsQuery.data, driftByEtab, feedbackByEtab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/reconciliation"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            Retour à la réconciliation
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Santé du matching Cashpad</h1>
          <p className="text-muted-foreground">
            Stats macro par établissement sur 30 jours, dérive d&apos;horloge POS, mappings serveurs
            et feedback loop des liens manuels.
          </p>
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertes ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-md border p-3 text-sm ${
                    a.severity === "warn"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-sky-500/40 bg-sky-500/5"
                  }`}
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="text-muted-foreground">{a.detail}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats par etab */}
      <Card>
        <CardHeader>
          <CardTitle>Établissements (30 jours)</CardTitle>
          <CardDescription>
            Taux de match, confiance moyenne, paramètres adaptatifs en cours.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Établissement</TableHead>
                <TableHead className="text-right">Receipts</TableHead>
                <TableHead className="text-right">Matchés</TableHead>
                <TableHead className="text-right">Ambigus</TableHead>
                <TableHead className="text-right">Orphans</TableHead>
                <TableHead className="text-right">Cashback</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">Confiance</TableHead>
                <TableHead className="text-right">Offset</TableHead>
                <TableHead className="text-right">Fenêtre</TableHead>
                <TableHead className="text-right">Dérive 7j</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statsQuery.data ?? []).map((s) => {
                const drift = driftByEtab.get(s.establishment_id);
                return (
                  <TableRow key={s.establishment_id}>
                    <TableCell className="font-medium">{s.establishment_title}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.n_total}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.n_matched}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.n_ambiguous}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.n_orphan}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.n_excluded}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${pctColor(s.match_rate_pct)}`}>
                      {s.match_rate_pct !== null ? `${s.match_rate_pct}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.avg_confidence !== null ? s.avg_confidence : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.current_offset_s !== null ? `${s.current_offset_s > 0 ? "+" : ""}${s.current_offset_s}s` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.current_window_s !== null ? `${s.current_window_s}s` : "défaut"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {drift && drift.drift_s !== null ? (
                        <span
                          className={
                            Math.abs(drift.drift_s) > DRIFT_ALERT_SECONDS
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {drift.drift_s > 0 ? "+" : ""}
                          {drift.drift_s}s
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feedback loop liens manuels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-violet-500" />
            Feedback loop des liens manuels
          </CardTitle>
          <CardDescription>
            Quand tu lies manuellement un ticket hors de la fenêtre actuelle, c&apos;est un
            signal que la fenêtre est trop serrée. La colonne « Suggéré » montre le p95
            si on incluait ces liens.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Établissement</TableHead>
                <TableHead className="text-right">Liens manuels</TableHead>
                <TableHead className="text-right">Hors fenêtre</TableHead>
                <TableHead className="text-right">Fenêtre actuelle</TableHead>
                <TableHead className="text-right">Suggéré (p95)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feedbackQuery.data ?? [])
                .filter((f) => f.manual_links_total > 0)
                .map((f) => {
                  const stat = statsQuery.data?.find(
                    (s) => s.establishment_id === f.establishment_id,
                  );
                  const oow = f.manual_links_out_of_window;
                  return (
                    <TableRow key={f.establishment_id}>
                      <TableCell className="font-medium">
                        {stat?.establishment_title ?? `#${f.establishment_id}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.manual_links_total}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          oow > 0 ? "text-amber-600 dark:text-amber-400" : ""
                        }`}
                      >
                        {oow}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.current_window_s}s
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.suggested_window_p95 !== null
                          ? `${f.suggested_window_p95}s`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {(feedbackQuery.data ?? []).filter((f) => f.manual_links_total > 0).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Aucun lien manuel enregistré pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mappings employés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            Mappings serveurs Royaume ↔ Cashpad
          </CardTitle>
          <CardDescription>
            Associe les profils employés Royaume à leur identifiant côté Cashpad. Permet de
            départager automatiquement les matchs ambigus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(statsQuery.data ?? []).map((s) => (
                <Button
                  key={s.establishment_id}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOpenMappingFor({
                      installationId: s.cashpad_installation_id,
                      title: s.establishment_title,
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {s.establishment_title}
                </Button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profil Royaume</TableHead>
                  <TableHead>Installation</TableHead>
                  <TableHead>Utilisateur Cashpad</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mappingsQuery.data ?? []).map((m: EmployeeMappingWithProfile) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.profile
                        ? `${m.profile.first_name ?? ""} ${m.profile.last_name ?? ""}`.trim() ||
                          m.profile.email ||
                          m.profile.id.slice(0, 8)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.installation_id}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.cashpad_user_name ?? "—"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.cashpad_user_id.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMut.mutate(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(mappingsQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun mapping. Clique sur un établissement ci-dessus pour en créer un.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* État global rassurant */}
      {alerts.length === 0 && (statsQuery.data ?? []).some((s) => s.n_total > 0) && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Aucune alerte active
          </div>
        </div>
      )}

      {openMappingFor && (
        <MappingDialog
          installationId={openMappingFor.installationId}
          establishmentTitle={openMappingFor.title}
          open={true}
          onClose={() => setOpenMappingFor(null)}
        />
      )}
    </div>
  );
}
