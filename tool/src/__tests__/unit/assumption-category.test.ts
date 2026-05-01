import { describe, it, expect } from "vitest";
import { AssumptionCategory } from "@/generated/prisma/client";

// These must be kept in sync manually — this test exists to catch drift.
const SIDECAR_ASSUMPTION_CATEGORY_VALUES = [
  "SCOPE",
  "REGULATORY",
  "INTEGRATION",
  "MIGRATION",
  "OPERATIONAL",
  "PERFORMANCE",
] as const;

describe("AssumptionCategory enum alignment (Prisma ⇄ Zod sidecar)", () => {
  it("Prisma enum values match sidecar extractor ASSUMPTION_CATEGORY_VALUES", () => {
    const prismaValues = Object.values(AssumptionCategory).sort();
    const sidecarValues = [...SIDECAR_ASSUMPTION_CATEGORY_VALUES].sort();
    expect(prismaValues).toEqual(sidecarValues);
  });

  it("every sidecar value is a valid Prisma AssumptionCategory", () => {
    for (const v of SIDECAR_ASSUMPTION_CATEGORY_VALUES) {
      expect(Object.values(AssumptionCategory)).toContain(v);
    }
  });
});
