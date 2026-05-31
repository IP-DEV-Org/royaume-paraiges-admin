import { z } from "zod";

/**
 * Validation des payloads de mutation sur la table `receipts`.
 *
 * La suppression d'un ticket passe par la RPC `admin_delete_receipt`
 * (SECURITY DEFINER, admin-only) qui orchestre la cascade contrôlée
 * (receipt_lines → gains → receipts) — voir migration 044.
 */
export const deleteReceiptSchema = z.object({
  receiptId: z.number().int().positive(),
});

export type DeleteReceiptInput = z.infer<typeof deleteReceiptSchema>;
