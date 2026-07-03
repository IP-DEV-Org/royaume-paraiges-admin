import { z } from "zod";
import { FEATURE_KEYS } from "@/lib/features";

export const featureKeySchema = z.enum(FEATURE_KEYS);

export const toggleFeatureSchema = z.object({
  profileId: z.string().uuid(),
  featureKey: featureKeySchema,
});

export type ToggleFeatureInput = z.infer<typeof toggleFeatureSchema>;
