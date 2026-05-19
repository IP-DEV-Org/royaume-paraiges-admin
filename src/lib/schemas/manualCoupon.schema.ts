import { z } from "zod";

export const manualCouponSchema = z
  .object({
    customerId: z.uuid(),
    templateId: z.number().int().positive().optional(),
    amount: z.number().int().positive().optional(),
    percentage: z.number().int().min(1).max(100).optional(),
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu")
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      const sources = [data.templateId, data.amount, data.percentage].filter(
        (v) => v !== undefined
      );
      return sources.length === 1;
    },
    {
      message: "Un seul champ parmi templateId, amount, percentage doit être fourni",
      path: ["templateId"],
    }
  );

export type ManualCouponInput = z.infer<typeof manualCouponSchema>;
