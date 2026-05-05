import { describe, it, expect } from "vitest";
import {
  achievementBadgeSchema,
  achievementBadgeUpdateSchema,
} from "../achievement.schema";

const base = {
  slug: "achievement_test",
  name: "Test",
  rarity: "common" as const,
  evaluation_mode: "realtime" as const,
};

describe("achievementBadgeSchema", () => {
  it("first_order : criterion_params vide accepté", () => {
    const result = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "first_order",
      criterion_params: {},
    });
    expect(result.success).toBe(true);
  });

  it("orders_threshold : threshold ≥ 1 requis dans criterion_params", () => {
    const ok = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "orders_threshold",
      criterion_params: { threshold: 10 },
    });
    expect(ok.success).toBe(true);

    const missing = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "orders_threshold",
      criterion_params: {},
    });
    expect(missing.success).toBe(false);
  });

  it("cities_visited : min_cities requis", () => {
    const ok = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "cities_visited",
      criterion_params: { min_cities: 3 },
    });
    expect(ok.success).toBe(true);

    const missing = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "cities_visited",
      criterion_params: { threshold: 3 },
    });
    expect(missing.success).toBe(false);
  });

  it("consecutive_weekly_quests : exige evaluation_mode = cron", () => {
    const realtime = achievementBadgeSchema.safeParse({
      ...base,
      criterion_type: "consecutive_weekly_quests",
      criterion_params: { n_weeks: 4 },
      evaluation_mode: "realtime",
    });
    expect(realtime.success).toBe(false);

    const cron = achievementBadgeSchema.safeParse({
      ...base,
      evaluation_mode: "cron",
      criterion_type: "consecutive_weekly_quests",
      criterion_params: { n_weeks: 4 },
    });
    expect(cron.success).toBe(true);
  });

  it("rejette un slug avec majuscules", () => {
    const result = achievementBadgeSchema.safeParse({
      ...base,
      slug: "Achievement_Test",
      criterion_type: "first_order",
      criterion_params: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("achievementBadgeUpdateSchema", () => {
  it("accepte un patch sans criterion_type", () => {
    const result = achievementBadgeUpdateSchema.safeParse({ name: "X" });
    expect(result.success).toBe(true);
  });

  it("re-valide les params si criterion_type + params + mode sont fournis", () => {
    const result = achievementBadgeUpdateSchema.safeParse({
      criterion_type: "consecutive_weekly_quests",
      criterion_params: { n_weeks: 4 },
      evaluation_mode: "realtime",
    });
    expect(result.success).toBe(false);
  });
});
