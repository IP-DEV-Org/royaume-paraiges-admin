import { describe, it, expect } from "vitest";
import { manualCouponSchema } from "../manualCoupon.schema";

const validUuid = "11111111-1111-4111-8111-111111111111";

describe("manualCouponSchema", () => {
  it("rejette si aucun parmi templateId/amount/percentage n'est fourni", () => {
    const result = manualCouponSchema.safeParse({ customerId: validUuid });
    expect(result.success).toBe(false);
  });

  it("rejette si plusieurs parmi templateId/amount/percentage sont fournis", () => {
    const result = manualCouponSchema.safeParse({
      customerId: validUuid,
      templateId: 1,
      amount: 500,
    });
    expect(result.success).toBe(false);
  });

  it("accepte template seul", () => {
    const result = manualCouponSchema.safeParse({
      customerId: validUuid,
      templateId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepte amount seul", () => {
    const result = manualCouponSchema.safeParse({
      customerId: validUuid,
      amount: 500,
    });
    expect(result.success).toBe(true);
  });

  it("accepte percentage seul (1-100)", () => {
    const ok = manualCouponSchema.safeParse({
      customerId: validUuid,
      percentage: 10,
    });
    expect(ok.success).toBe(true);

    const tooLow = manualCouponSchema.safeParse({
      customerId: validUuid,
      percentage: 0,
    });
    expect(tooLow.success).toBe(false);

    const tooHigh = manualCouponSchema.safeParse({
      customerId: validUuid,
      percentage: 101,
    });
    expect(tooHigh.success).toBe(false);
  });

  it("rejette un customerId qui n'est pas un UUID", () => {
    const result = manualCouponSchema.safeParse({
      customerId: "not-a-uuid",
      amount: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejette un format de date différent de YYYY-MM-DD", () => {
    const result = manualCouponSchema.safeParse({
      customerId: validUuid,
      amount: 500,
      expiresAt: "2026/12/31",
    });
    expect(result.success).toBe(false);
  });

  it("accepte expiresAt au bon format", () => {
    const result = manualCouponSchema.safeParse({
      customerId: validUuid,
      amount: 500,
      expiresAt: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });
});
