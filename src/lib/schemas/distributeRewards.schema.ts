import { z } from "zod";

export const periodTypeSchema = z.enum(["weekly", "monthly", "yearly"]);

export const distributeRewardsSchema = z.object({
  periodType: periodTypeSchema,
  periodIdentifier: z.string().min(1).optional(),
  force: z.boolean().default(false),
  previewOnly: z.boolean().default(false),
});

export type DistributeRewardsInput = z.infer<typeof distributeRewardsSchema>;
