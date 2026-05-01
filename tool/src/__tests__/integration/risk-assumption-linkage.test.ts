import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  seedUser,
  seedEngagement,
  seedPhase,
  seedAssumptions,
  truncateAll,
} from "../../../prisma/test-helpers";
import { createTestPrisma } from "./setup/prisma-test-client";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterEach(async () => {
  await truncateAll(prisma);
});

describe("RiskRegisterEntry ⇄ Assumption M2M linkage (_RiskToAssumption)", () => {
  it("links risk to assumptions and queries both directions", async () => {
    const user = await seedUser(prisma);
    const engagement = await seedEngagement(prisma, user.id);
    const phase = await seedPhase(prisma, engagement.id, "1A");
    await seedAssumptions(prisma, engagement.id, phase.id, 2);

    const assumptions = await prisma.assumption.findMany({
      where: { engagementId: engagement.id },
    });

    const risk = await prisma.riskRegisterEntry.create({
      data: {
        engagementId: engagement.id,
        task: "Auth integration",
        tab: "BACKEND",
        conf: 3,
        risk: "SSO provider undecided",
        openQuestion: "Which IdP?",
        recommendedAction: "Confirm before sprint",
        hoursAtRisk: 16,
        assumptionRefs: {
          connect: assumptions.map((a) => ({ id: a.id })),
        },
      },
    });

    // Query Risk → Assumptions
    const riskWithAssumptions = await prisma.riskRegisterEntry.findUniqueOrThrow({
      where: { id: risk.id },
      include: { assumptionRefs: true },
    });
    expect(riskWithAssumptions.assumptionRefs).toHaveLength(2);
    const codes = riskWithAssumptions.assumptionRefs.map((a) => a.code);
    expect(codes).toContain("A-SC-001");

    // Query Assumption → Risks (reverse direction)
    const assumptionWithRisks = await prisma.assumption.findUniqueOrThrow({
      where: { id: assumptions[0].id },
      include: { riskRegisterRefs: true },
    });
    expect(assumptionWithRisks.riskRegisterRefs).toHaveLength(1);
    expect(assumptionWithRisks.riskRegisterRefs[0].id).toBe(risk.id);
  });
});

describe("RiskRegisterEntry ⇄ LineItem M2M linkage (_RiskToLineItem)", () => {
  it("links risk to line items and queries both directions", async () => {
    const user = await seedUser(prisma);
    const engagement = await seedEngagement(prisma, user.id);
    const phase = await seedPhase(prisma, engagement.id, "1A");

    const lineItem = await prisma.lineItem.create({
      data: {
        engagementId: engagement.id,
        sourcePhaseId: phase.id,
        tab: "BACKEND",
        task: "OAuth integration",
        description: "OIDC flow",
        hours: 24,
        conf: 3,
        lowHrs: 24,
        highHrs: 36,
      },
    });

    const risk = await prisma.riskRegisterEntry.create({
      data: {
        engagementId: engagement.id,
        task: "OAuth integration",
        tab: "BACKEND",
        conf: 3,
        risk: "Provider not confirmed",
        openQuestion: "Which OAuth provider?",
        recommendedAction: "Confirm in sprint 0",
        hoursAtRisk: 12,
        lineItemRefs: {
          connect: [{ id: lineItem.id }],
        },
      },
    });

    // Query Risk → LineItems
    const riskWithItems = await prisma.riskRegisterEntry.findUniqueOrThrow({
      where: { id: risk.id },
      include: { lineItemRefs: true },
    });
    expect(riskWithItems.lineItemRefs).toHaveLength(1);
    expect(riskWithItems.lineItemRefs[0].task).toBe("OAuth integration");

    // Query LineItem → Risks (reverse direction)
    const itemWithRisks = await prisma.lineItem.findUniqueOrThrow({
      where: { id: lineItem.id },
      include: { riskRegisterRefs: true },
    });
    expect(itemWithRisks.riskRegisterRefs).toHaveLength(1);
    expect(itemWithRisks.riskRegisterRefs[0].id).toBe(risk.id);
  });
});
