import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "destructive"
  | "neutral"
  | "info";

const toneClasses: Record<StatusTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  destructive:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  neutral:
    "border-border bg-muted text-muted-foreground",
  info:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
};

// Registre central statut → libellé FR + tonalité. Un même statut a ainsi la
// même couleur sur toutes les pages (réconciliation, tickets, périodes, RGPD…).
const statusRegistry: Record<string, { label: string; tone: StatusTone }> = {
  // Réconciliation Cashpad
  matched: { label: "Matché", tone: "success" },
  ambiguous: { label: "Ambigu", tone: "warning" },
  orphan_royaume: { label: "Orphelin", tone: "destructive" },
  excluded_cashback: { label: "100 % PdB", tone: "neutral" },
  // Distributions de récompenses
  pending: { label: "En attente", tone: "warning" },
  distributed: { label: "Distribuée", tone: "success" },
  cancelled: { label: "Annulée", tone: "destructive" },
  failed: { label: "Échouée", tone: "destructive" },
  // Progression de quêtes
  in_progress: { label: "En cours", tone: "info" },
  completed: { label: "Complétée", tone: "success" },
  rewarded: { label: "Récompensée", tone: "success" },
  expired: { label: "Expirée", tone: "neutral" },
  // RGPD
  submitted: { label: "Soumise", tone: "warning" },
  processing: { label: "En traitement", tone: "info" },
  // Coupons
  active: { label: "Actif", tone: "success" },
  used: { label: "Utilisé", tone: "neutral" },
};

interface StatusBadgeProps {
  status: string;
  /** Libellé affiché — par défaut, celui du registre, sinon le statut brut. */
  label?: string;
  /** Tonalité forcée — par défaut, celle du registre, sinon neutral. */
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const entry = statusRegistry[status];
  const resolvedTone = tone ?? entry?.tone ?? "neutral";
  const resolvedLabel = label ?? entry?.label ?? status;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", toneClasses[resolvedTone], className)}
    >
      {resolvedLabel}
    </Badge>
  );
}
