import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createCodeGenerator } from "@/lib/ai/assumption-code";
import { seedUser, seedEngagement, seedPhase, truncateAll } from "../../../prisma/test-helpers";
import { createTestPrisma } from "./setup/prisma-test-client";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterEach(async () => {
  await truncateAll(prisma);
});

describe("assumption code generation", () => {
  it("produces strictly increasing codes in a single write batch", async () => {
    const user = await seedUser(prisma);
    const engagement = await seedEngagement(prisma, user.id);
    const phase = await seedPhase(prisma, engagement.id, "1A");

    const nextCode = createCodeGenerator();
    const inputs = Array.from({ length: 5 }, (_, i) => ({
      engagementId: engagement.id,
      sourcePhaseId: phase.id,
      text: `Assumption ${i + 1}`,
      impactIfWrong: "Risk",
      category: "SCOPE" as const,
      tab: "GENERAL",
      code: nextCode("SCOPE"),
      status: "ACTIVE" as const,
    }));

    await prisma.assumption.createMany({ data: inputs });

    const rows = await prisma.assumption.findMany({
      where: { engagementId: engagement.id },
      orderBy: { createdAt: "asc" },
    });

    const codes = rows.map((r) => r.code);
    expect(codes).toEqual(["A-SC-001", "A-SC-002", "A-SC-003", "A-SC-004", "A-SC-005"]);
  });

  it("documents code collision risk: two independent generators on the same engagement both emit A-SC-001", async () => {
    // This test documents a KNOWN ISSUE (R1 from the risk register):
    // createCodeGenerator() is request-local — concurrent phase runs on the same
    // engagement can each start at A-SC-001. Track fix: use DB-backed nextval sequence.
    const gen1 = createCodeGenerator();
    const gen2 = createCodeGenerator();
    expect(gen1("SCOPE")).toBe("A-SC-001");
    expect(gen2("SCOPE")).toBe("A-SC-001"); // collision — both start at 001
  });
});
