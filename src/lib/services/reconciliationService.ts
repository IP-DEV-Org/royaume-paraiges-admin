import { createClient } from "@/lib/supabase/client";
import type {
  CashpadReceiptSnapshot,
  CashpadReconciliation,
  ReconciliationStatus,
} from "@/types/database";

/**
 * Accès aux tables `cashpad_reconciliations` et `cashpad_receipts_snapshot`
 * (migration 032). RLS admin-only : le contrôle d'accès est délégué à
 * PostgreSQL, pas de vérification ici.
 */

export interface ReconciliationFilters {
  /** Date unique (rétrocompat). Si fournie, equivaut à startDate=endDate=date. */
  date?: string;
  /** Début de la plage (UTC, YYYY-MM-DD). */
  startDate?: string;
  /** Fin de la plage incluse (UTC, YYYY-MM-DD). */
  endDate?: string;
  establishmentId?: number;
  status?: ReconciliationStatus;
}

export interface ReconciliationRow extends CashpadReconciliation {
  receipt: {
    id: number;
    amount: number;
    created_at: string;
    establishment_id: number;
    customer_id: string;
    establishment?: { id: number; title: string } | null;
    customer?: {
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };
  cashpad_snapshot: CashpadReceiptSnapshot | null;
}

export interface ReconciliationStats {
  matched: number;
  orphan_royaume: number;
  ambiguous: number;
  total: number;
}

function rangeBounds(filters: ReconciliationFilters): { start: string; end: string } | null {
  const startStr = filters.startDate ?? filters.date;
  const endStr = filters.endDate ?? filters.date;
  if (!startStr || !endStr) return null;
  const start = new Date(`${startStr}T00:00:00Z`);
  const endInclusive = new Date(`${endStr}T00:00:00Z`);
  const endExclusive = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: endExclusive.toISOString() };
}

export async function listReconciliations(
  filters: ReconciliationFilters,
): Promise<ReconciliationRow[]> {
  const supabase = createClient();

  // !inner force PostgREST à filtrer aussi les rows parent (cashpad_reconciliations)
  // quand on filtre sur les colonnes du receipt. Sans !inner, on récupère toutes
  // les rows parent et l'embed est null pour celles qui ne matchent pas → on devait
  // re-filtrer côté client, fragile et lent.
  let query = supabase
    .from("cashpad_reconciliations")
    .select(
      `
      *,
      receipt:receipts!receipt_id!inner(
        id,
        amount,
        created_at,
        establishment_id,
        customer_id,
        establishment:establishments!establishment_id(id, title),
        customer:profiles!customer_id(id, email, first_name, last_name)
      ),
      cashpad_snapshot:cashpad_receipts_snapshot!cashpad_reconciliations_cashpad_receipt_id_fkey(*)
      `,
    )
    .order("reconciled_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const bounds = rangeBounds(filters);
  if (bounds) {
    query = query
      .gte("receipt.created_at", bounds.start)
      .lt("receipt.created_at", bounds.end);
  }

  if (filters.establishmentId) {
    query = query.eq("receipt.establishment_id", filters.establishmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Avec !inner, PostgREST a déjà filtré côté serveur. Pas besoin de re-filtrer.
  return ((data ?? []) as unknown as ReconciliationRow[]).filter((r) => r.receipt);
}

export async function getReconciliationStats(
  filters: Omit<ReconciliationFilters, "status">,
): Promise<ReconciliationStats> {
  const rows = await listReconciliations(filters);
  const stats: ReconciliationStats = {
    matched: 0,
    orphan_royaume: 0,
    ambiguous: 0,
    total: rows.length,
  };
  for (const r of rows) {
    if (r.status === "matched") stats.matched++;
    else if (r.status === "orphan_royaume") stats.orphan_royaume++;
    else if (r.status === "ambiguous") stats.ambiguous++;
  }
  return stats;
}

/**
 * Cherche les tickets Cashpad candidats pour un receipt orphan en élargissant
 * la fenêtre temporelle (par défaut ±30 min) — usage : arbitrage manuel
 * depuis l'UI admin lorsqu'aucun match auto n'a été trouvé.
 */
export async function findCashpadCandidates(
  receiptId: number,
  windowSeconds = 1800,
): Promise<CashpadReceiptSnapshot[]> {
  const supabase = createClient();

  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .select("id, amount, created_at, establishment_id")
    .eq("id", receiptId)
    .single();
  if (rErr || !receipt) throw rErr ?? new Error("Receipt not found");

  const r = receipt as {
    id: number;
    amount: number;
    created_at: string;
    establishment_id: number;
  };
  const tMs = new Date(r.created_at).getTime();
  const startISO = new Date(tMs - windowSeconds * 1000).toISOString();
  const endISO = new Date(tMs + windowSeconds * 1000).toISOString();

  const { data, error } = await supabase
    .from("cashpad_receipts_snapshot")
    .select("*")
    .eq("establishment_id", r.establishment_id)
    .eq("amount_cents", Math.round(r.amount))
    .gte("closed_at", startISO)
    .lte("closed_at", endISO)
    .order("closed_at", { ascending: true });
  if (error) throw error;

  return (data ?? []) as CashpadReceiptSnapshot[];
}

/**
 * Charge les snapshots Cashpad correspondant à une liste d'IDs — usage :
 * affichage des candidats déjà détectés pour un receipt `ambiguous`, sans
 * relancer une recherche par fenêtre temporelle.
 */
export async function getCashpadSnapshotsByIds(
  ids: string[],
): Promise<CashpadReceiptSnapshot[]> {
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cashpad_receipts_snapshot")
    .select("*")
    .in("cashpad_receipt_id", ids)
    .order("closed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CashpadReceiptSnapshot[];
}

/**
 * Lien manuel d'un receipt Royaume à un ticket Cashpad. Tag l'audit
 * (`manually_linked_by` + `manually_linked_at`) afin que la prochaine
 * réconciliation auto ne réécrase pas le choix admin.
 */
export async function linkManually(params: {
  receiptId: number;
  cashpadReceiptId: string;
  notes?: string;
}): Promise<CashpadReconciliation> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const adminId = userData.user?.id ?? null;

  // Compute the signed delta to feed the feedback loop.
  const { data: receipt } = await supabase
    .from("receipts")
    .select("created_at")
    .eq("id", params.receiptId)
    .single();
  const { data: snapshot } = await supabase
    .from("cashpad_receipts_snapshot")
    .select("closed_at")
    .eq("cashpad_receipt_id", params.cashpadReceiptId)
    .single();

  let manualLinkDelta: number | null = null;
  const rCreatedAt = (receipt as { created_at?: string } | null)?.created_at;
  const sClosedAt = (snapshot as { closed_at?: string } | null)?.closed_at;
  if (rCreatedAt && sClosedAt) {
    manualLinkDelta = Math.round(
      (new Date(sClosedAt).getTime() - new Date(rCreatedAt).getTime()) / 1000,
    );
  }

  const updatePayload = {
    cashpad_receipt_id: params.cashpadReceiptId,
    status: "matched" as ReconciliationStatus,
    candidates: null,
    manually_linked_by: adminId,
    manually_linked_at: new Date().toISOString(),
    manual_link_delta_seconds: manualLinkDelta,
    time_delta_seconds: manualLinkDelta,
    notes: params.notes ?? null,
  };

  // Convention admin : `(supabase.from(...) as any)` pour les writes.

  const { data, error } = await (supabase.from("cashpad_reconciliations") as any)
    .update(updatePayload)
    .eq("receipt_id", params.receiptId)
    .select()
    .single();
  if (error) throw error;
  return data as CashpadReconciliation;
}

/**
 * Déclenche manuellement la réconciliation pour une date / un établissement.
 * Appelle l'Edge Function `cashpad-reconcile-daily` via le client Supabase
 * (qui pose automatiquement le bearer de la session).
 */
export interface TriggerReconcileResult {
  summary: {
    start_date: string;
    end_date: string;
    days_processed: number;
    days_total: number;
    completed_through: string | null;
    next_start_date: string | null;
    partial: boolean;
    establishments: number;
    cashpad_tickets_fetched: number;
    /** Tickets Cashpad réellement encaissés (non annulés, montant > 0) — c'est
     * le décompte affiché par Cashpad. Sous-ensemble de cashpad_tickets_fetched. */
    cashpad_tickets_encaisses?: number;
    royaume_receipts: number;
    matched: number;
    orphan_royaume: number;
    ambiguous: number;
    errors: Array<{ establishment_id: number; date?: string; message: string }>;
  };
}

export async function triggerReconciliation(params: {
  startDate?: string;
  endDate?: string;
  /** Rétrocompat : équivaut à startDate=endDate=date. */
  date?: string;
  establishmentId?: number;
}): Promise<TriggerReconcileResult> {
  const supabase = createClient();
  const body: Record<string, unknown> = {};
  if (params.startDate && params.endDate) {
    body.start_date = params.startDate;
    body.end_date = params.endDate;
  } else if (params.date) {
    body.date = params.date;
  }
  if (params.establishmentId) body.establishment_id = params.establishmentId;

  const { data, error } = await supabase.functions.invoke<TriggerReconcileResult>(
    "cashpad-reconcile-daily",
    { body },
  );
  if (error) throw error;
  if (!data) throw new Error("Empty response from cashpad-reconcile-daily");
  return data;
}

// ============================================================================
// Réconciliation progressive : itère jour par jour côté frontend pour donner
// un feedback de progression à l'UI (barre + compteurs cumulés).
// ============================================================================

/**
 * Date (UTC YYYY-MM-DD) du premier receipt enregistré dans le Royaume sur un
 * établissement Cashpad. Utilisé par le bouton "Réconciliation globale".
 */
export async function getFirstRoyaumeReceiptDate(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select("created_at, establishments!inner(cashpad_installation_id)")
    .not("establishments.cashpad_installation_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const first = (data as { created_at?: string } | null)?.created_at;
  if (!first) return null;
  return new Date(first).toISOString().slice(0, 10);
}

function enumerateDaysInclusive(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export interface ReconcileProgress {
  daysProcessed: number;
  daysTotal: number;
  currentDate: string | null;
  cashpad_tickets_fetched: number;
  cashpad_tickets_encaisses: number;
  royaume_receipts: number;
  matched: number;
  orphan_royaume: number;
  ambiguous: number;
  errors: TriggerReconcileResult["summary"]["errors"];
  aborted: boolean;
  done: boolean;
}

export async function triggerReconciliationProgressive(params: {
  startDate: string;
  endDate: string;
  establishmentId?: number;
  onProgress?: (p: ReconcileProgress) => void;
  signal?: AbortSignal;
}): Promise<ReconcileProgress> {
  const days = enumerateDaysInclusive(params.startDate, params.endDate);
  const progress: ReconcileProgress = {
    daysProcessed: 0,
    daysTotal: days.length,
    currentDate: null,
    cashpad_tickets_fetched: 0,
    cashpad_tickets_encaisses: 0,
    royaume_receipts: 0,
    matched: 0,
    orphan_royaume: 0,
    ambiguous: 0,
    errors: [],
    aborted: false,
    done: false,
  };

  // Émission initiale pour permettre à l'UI d'afficher 0 / N tout de suite.
  params.onProgress?.({ ...progress });

  for (const day of days) {
    if (params.signal?.aborted) {
      progress.aborted = true;
      break;
    }
    progress.currentDate = day;
    params.onProgress?.({ ...progress });

    try {
      const result = await triggerReconciliation({
        date: day,
        establishmentId: params.establishmentId,
      });
      const s = result.summary;
      progress.cashpad_tickets_fetched += s.cashpad_tickets_fetched;
      progress.cashpad_tickets_encaisses += s.cashpad_tickets_encaisses ?? 0;
      progress.royaume_receipts += s.royaume_receipts;
      progress.matched += s.matched;
      progress.orphan_royaume += s.orphan_royaume;
      progress.ambiguous += s.ambiguous;
      if (s.errors?.length) progress.errors.push(...s.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.errors.push({ establishment_id: 0, date: day, message: msg });
    }

    progress.daysProcessed += 1;
    params.onProgress?.({ ...progress });
  }

  progress.done = true;
  progress.currentDate = null;
  params.onProgress?.({ ...progress });
  return progress;
}
