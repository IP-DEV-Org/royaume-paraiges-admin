import { createClient } from "@/lib/supabase/client";
import {
  Receipt,
  ReceiptLine,
  ReceiptConsumptionItem,
  CashpadReceiptSnapshot,
  ReconciliationStatus,
} from "@/types/database";
import { deleteReceiptSchema } from "@/lib/schemas/receipt.schema";

export interface ReceiptFilters {
  customerId?: string;
  establishmentId?: number;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
}

export interface ReceiptCashpadReconciliation {
  status: ReconciliationStatus;
  confidence_score: number | null;
  time_delta_seconds: number | null;
  manually_linked_at: string | null;
  cashpad_snapshot: CashpadReceiptSnapshot | null;
}

export interface ReceiptWithDetails extends Receipt {
  customer?: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  lines?: ReceiptLine[];
  receipt_lines?: ReceiptLine[];
  receipt_consumption_items?: ReceiptConsumptionItem[];
  cashpad_reconciliation?: ReceiptCashpadReconciliation | null;
}

export async function getReceipts(
  filters?: ReceiptFilters,
  limit = 20,
  offset = 0
): Promise<{ data: ReceiptWithDetails[]; count: number }> {
  const supabase = createClient();

  const receiptLinesSelect = filters?.paymentMethod
    ? "receipt_lines!inner(id, amount, payment_method)"
    : "receipt_lines(id, amount, payment_method)";

  let query = supabase
    .from("receipts")
    .select(
      `
      *,
      customer:profiles!customer_id(id, email, first_name, last_name),
      ${receiptLinesSelect},
      receipt_consumption_items(id, consumption_type, quantity),
      cashpad_reconciliation:cashpad_reconciliations!cashpad_reconciliations_receipt_id_fkey(
        status,
        confidence_score,
        time_delta_seconds,
        manually_linked_at,
        cashpad_snapshot:cashpad_receipts_snapshot!cashpad_reconciliations_cashpad_receipt_id_fkey(*)
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filters?.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }

  if (filters?.establishmentId) {
    query = query.eq("establishment_id", filters.establishmentId);
  }

  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  if (filters?.paymentMethod) {
    query = query.eq("receipt_lines.payment_method", filters.paymentMethod);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }

  return { data: (data || []) as ReceiptWithDetails[], count: count || 0 };
}

export async function getReceipt(
  receiptId: number
): Promise<ReceiptWithDetails | null> {
  const supabase = createClient();

  const { data: receipt, error } = await supabase
    .from("receipts")
    .select(
      `
      *,
      customer:profiles!customer_id(id, email, first_name, last_name),
      receipt_consumption_items(id, consumption_type, quantity),
      cashpad_reconciliation:cashpad_reconciliations!cashpad_reconciliations_receipt_id_fkey(
        status,
        confidence_score,
        time_delta_seconds,
        manually_linked_at,
        cashpad_snapshot:cashpad_receipts_snapshot!cashpad_reconciliations_cashpad_receipt_id_fkey(*)
      )
    `
    )
    .eq("id", receiptId)
    .single();

  if (error || !receipt) {
    console.error("Error fetching receipt:", error);
    return null;
  }

  const { data: lines } = await supabase
    .from("receipt_lines")
    .select("*")
    .eq("receipt_id", receiptId)
    .order("id");

  return {
    ...(receipt as ReceiptWithDetails),
    lines: (lines || []) as ReceiptLine[],
  };
}

/**
 * Supprime un ticket et toute sa cascade (receipt_lines, gains,
 * receipt_consumption_items, spendings, cashpad_reconciliations) via la RPC
 * `admin_delete_receipt` (atomique + ordre maîtrisé pour ne pas déclencher le
 * faux positif du garde-fou solde négatif). Cf. migration 044.
 *
 * Lève une erreur :
 * - `P0423` (CASHBACK_BALANCE_NEGATIVE) si les PdB gagnés sur ce ticket ont
 *   déjà été dépensés ailleurs → suppression refusée pour ne pas corrompre le solde ;
 * - `P0002` si le ticket est introuvable ;
 * - `42501` si l'appelant n'est pas admin.
 */
export async function deleteReceipt(receiptId: number): Promise<void> {
  const { receiptId: id } = deleteReceiptSchema.parse({ receiptId });

  const supabase = createClient();
  const { error } = await (supabase.rpc as any)("admin_delete_receipt", {
    p_receipt_id: id,
  });

  if (error) {
    console.error("Error deleting receipt:", error);
    throw error;
  }
}

export async function getReceiptStats(): Promise<{
  totalReceipts: number;
  totalRevenue: number;
  averageAmount: number;
  receiptsThisMonth: number;
  revenueThisMonth: number;
  paymentMethodBreakdown: { method: string; total: number; count: number }[];
}> {
  const supabase = createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  type ReceiptAmount = { amount: number };
  type PaymentLine = { amount: number; payment_method: string };

  const [allReceiptsResult, monthReceiptsResult, paymentLinesResult] =
    await Promise.all([
      supabase.from("receipts").select("amount"),
      supabase
        .from("receipts")
        .select("amount")
        .gte("created_at", startOfMonth.toISOString()),
      supabase.from("receipt_lines").select("amount, payment_method"),
    ]);

  const allReceipts = (allReceiptsResult.data || []) as ReceiptAmount[];
  const monthReceipts = (monthReceiptsResult.data || []) as ReceiptAmount[];
  const paymentLines = (paymentLinesResult.data || []) as PaymentLine[];

  const totalReceipts = allReceipts.length;
  const totalRevenue = allReceipts.reduce((sum, r) => sum + r.amount, 0);
  const averageAmount = totalReceipts > 0 ? totalRevenue / totalReceipts : 0;
  const receiptsThisMonth = monthReceipts.length;
  const revenueThisMonth = monthReceipts.reduce((sum, r) => sum + r.amount, 0);

  const methodMap = new Map<string, { total: number; count: number }>();
  for (const line of paymentLines) {
    const existing = methodMap.get(line.payment_method) || {
      total: 0,
      count: 0,
    };
    methodMap.set(line.payment_method, {
      total: existing.total + line.amount,
      count: existing.count + 1,
    });
  }

  const paymentMethodBreakdown = Array.from(methodMap.entries()).map(
    ([method, data]) => ({
      method,
      total: data.total,
      count: data.count,
    })
  );

  return {
    totalReceipts,
    totalRevenue,
    averageAmount,
    receiptsThisMonth,
    revenueThisMonth,
    paymentMethodBreakdown,
  };
}

export async function getReceiptsByEstablishment(): Promise<
  { establishmentId: number; count: number; total: number }[]
> {
  const supabase = createClient();

  type ReceiptEstablishment = { establishment_id: number; amount: number };
  const { data, error } = await supabase.from("receipts").select("establishment_id, amount");

  if (error) {
    console.error("Error fetching receipts by establishment:", error);
    return [];
  }

  const typedData = (data || []) as ReceiptEstablishment[];
  const establishmentMap = new Map<
    number,
    { count: number; total: number }
  >();
  for (const receipt of typedData) {
    const existing = establishmentMap.get(receipt.establishment_id) || {
      count: 0,
      total: 0,
    };
    establishmentMap.set(receipt.establishment_id, {
      count: existing.count + 1,
      total: existing.total + receipt.amount,
    });
  }

  return Array.from(establishmentMap.entries())
    .map(([establishmentId, stats]) => ({
      establishmentId,
      count: stats.count,
      total: stats.total,
    }))
    .sort((a, b) => b.total - a.total);
}
