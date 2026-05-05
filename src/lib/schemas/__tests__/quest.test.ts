import { describe, it, expect } from "vitest";
import { questSchema, questUpdateSchema } from "../quest.schema";

const baseQuest = {
  slug: "ma_quete_test",
  name: "Ma quête",
  period_type: "weekly" as const,
  quest_type: "orders_count" as const,
  target_value: 5,
};

describe("questSchema", () => {
  it("accepte une quête orders_count valide", () => {
    expect(questSchema.safeParse(baseQuest).success).toBe(true);
  });

  it("rejette un slug avec majuscules ou tirets", () => {
    expect(
      questSchema.safeParse({ ...baseQuest, slug: "Ma-Quete" }).success,
    ).toBe(false);
  });

  it("rejette target_value négatif ou zéro", () => {
    expect(
      questSchema.safeParse({ ...baseQuest, target_value: 0 }).success,
    ).toBe(false);
    expect(
      questSchema.safeParse({ ...baseQuest, target_value: -5 }).success,
    ).toBe(false);
  });

  it("rejette consumption_count sans consumption_type", () => {
    const result = questSchema.safeParse({
      ...baseQuest,
      quest_type: "consumption_count",
    });
    expect(result.success).toBe(false);
  });

  it("accepte consumption_count avec consumption_type", () => {
    const result = questSchema.safeParse({
      ...baseQuest,
      quest_type: "consumption_count",
      consumption_type: "biere",
    });
    expect(result.success).toBe(true);
  });

  it("rejette consumption_type sur autre type que consumption_count", () => {
    const result = questSchema.safeParse({
      ...baseQuest,
      consumption_type: "biere",
    });
    expect(result.success).toBe(false);
  });

  it("rejette quest_completed + period_type weekly", () => {
    const result = questSchema.safeParse({
      ...baseQuest,
      quest_type: "quest_completed",
      period_type: "weekly",
    });
    expect(result.success).toBe(false);
  });

  it("accepte quest_completed avec monthly", () => {
    const result = questSchema.safeParse({
      ...baseQuest,
      quest_type: "quest_completed",
      period_type: "monthly",
    });
    expect(result.success).toBe(true);
  });

  it("appliquer les defaults : bonus_xp=0, is_active=true", () => {
    const result = questSchema.parse(baseQuest);
    expect(result.bonus_xp).toBe(0);
    expect(result.bonus_cashback).toBe(0);
    expect(result.is_active).toBe(true);
  });
});

describe("questUpdateSchema", () => {
  it("accepte un patch partiel", () => {
    const result = questUpdateSchema.safeParse({ name: "Nouveau nom" });
    expect(result.success).toBe(true);
  });

  it("garde la règle quest_completed + weekly", () => {
    const result = questUpdateSchema.safeParse({
      quest_type: "quest_completed",
      period_type: "weekly",
    });
    expect(result.success).toBe(false);
  });
});
