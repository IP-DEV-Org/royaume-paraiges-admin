import { describe, it, expect } from "vitest";
import { toggleFeatureSchema } from "../adminAccess.schema";
import { FEATURE_KEYS, FEATURE_ROUTES, resolveFeatureKey } from "@/lib/features";

const validUuid = "11111111-1111-4111-8111-111111111111";

describe("toggleFeatureSchema", () => {
  it("accepte un uuid + une feature connue", () => {
    const result = toggleFeatureSchema.safeParse({
      profileId: validUuid,
      featureKey: "analytics",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une feature inconnue", () => {
    const result = toggleFeatureSchema.safeParse({
      profileId: validUuid,
      featureKey: "does-not-exist",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un profileId non-uuid", () => {
    const result = toggleFeatureSchema.safeParse({
      profileId: "not-a-uuid",
      featureKey: "analytics",
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveFeatureKey", () => {
  it("chaque feature résout son propre href racine", () => {
    for (const key of FEATURE_KEYS) {
      expect(resolveFeatureKey(FEATURE_ROUTES[key])).toBe(key);
    }
  });

  it("les sous-routes héritent du parent", () => {
    expect(resolveFeatureKey("/quests/create")).toBe("quests");
    expect(resolveFeatureKey("/coupons/create")).toBe("coupons");
    expect(resolveFeatureKey("/reconciliation/health")).toBe("reconciliation");
    expect(resolveFeatureKey("/rewards/tiers")).toBe("rewards");
    expect(resolveFeatureKey("/rewards/season")).toBe("rewards");
  });

  it("longest-prefix : les entrées sidebar imbriquées gagnent sur leur parent", () => {
    expect(resolveFeatureKey("/rewards/achievements")).toBe("achievements");
    expect(resolveFeatureKey("/rewards/achievements/create")).toBe("achievements");
    expect(resolveFeatureKey("/rewards/cashback-gains")).toBe("cashback-gains");
  });

  it("dashboard et login ne sont jamais bloqués", () => {
    expect(resolveFeatureKey("/")).toBeNull();
    expect(resolveFeatureKey("/login")).toBeNull();
  });

  it("ne matche pas sur un simple préfixe de chaîne (pas de faux positifs)", () => {
    // /usersXYZ ne doit pas matcher /users
    expect(resolveFeatureKey("/usersXYZ")).toBeNull();
  });
});
