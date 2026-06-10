"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ReconciliationRow } from "@/lib/services/reconciliationService";

// =============================================================================
// Helpers de formatage et petits composants partagés entre les tables et les
// modales de la réconciliation Cashpad.
// =============================================================================

export function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `${(cents / 100).toFixed(2)} €`;
}

// Formats volontairement spécifiques à la réconciliation (les secondes sont
// load-bearing pour comparer Royaume ↔ Cashpad) — ne pas remplacer par les
// helpers de @/lib/utils, qui n'affichent pas les secondes.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DateTimeCell({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-sm">{formatDate(iso)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">{formatTimeOnly(iso)}</div>
    </div>
  );
}

export function formatDelta(seconds: number | null): string {
  if (seconds === null) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "";
  const abs = Math.abs(seconds);
  if (abs < 60) return `${sign}${abs}s`;
  return `${sign}${Math.floor(abs / 60)}m ${abs % 60}s`;
}

export function deltaColorClass(seconds: number | null): string {
  if (seconds === null) return "text-muted-foreground";
  const abs = Math.abs(seconds);
  if (abs <= 30) return "text-emerald-600 dark:text-emerald-400";
  if (abs <= 120) return "text-foreground";
  return "text-amber-600 dark:text-amber-400";
}

export function ConfidenceCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums">{score}</span>
    </div>
  );
}

export function getCustomerLabel(
  customer: ReconciliationRow["receipt"]["customer"] | null | undefined,
): string {
  if (!customer) return "—";
  return (
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
    customer.email ||
    customer.id.slice(0, 8)
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ── Loading skeletons ────────────────────────────────────────────────────────

export function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
