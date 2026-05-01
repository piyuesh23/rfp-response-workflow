import { PrismaClient } from "../src/generated/prisma/client";

export async function seedUser(prisma: PrismaClient, overrides: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: "Test User",
      role: "MANAGER",
      ...overrides,
    },
  });
}

export async function seedEngagement(
  prisma: PrismaClient,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  return prisma.engagement.create({
    data: {
      clientName: "Test Client",
      techStack: "DRUPAL",
      engagementType: "NEW_BUILD",
      status: "DRAFT",
      createdById: userId,
      ...overrides,
    },
  });
}

export async function seedPhase(
  prisma: PrismaClient,
  engagementId: string,
  phaseNumber = "1A"
) {
  return prisma.phase.create({
    data: {
      engagementId,
      phaseNumber,
      status: "APPROVED",
    },
  });
}

export async function seedAssumptions(
  prisma: PrismaClient,
  engagementId: string,
  sourcePhaseId: string,
  count = 3
) {
  const inputs = Array.from({ length: count }, (_, i) => ({
    engagementId,
    sourcePhaseId,
    text: `Assumption ${i + 1}`,
    torReference: `TOR-${i + 1}`,
    impactIfWrong: `Impact ${i + 1}`,
    code: i === 0 ? "A-RG-001" : `A-SC-${String(i).padStart(3, "0")}`,
    category: (i === 0 ? "REGULATORY" : "SCOPE") as "SCOPE" | "REGULATORY",
    tab: "GENERAL",
    regulationContext: i === 0 ? "HIPAA §164.312" : null,
    crBoundaryEffect: i === 0 ? "+8-12 hrs if this assumption is invalidated" : null,
    status: "ACTIVE" as const,
  }));
  return prisma.assumption.createMany({ data: inputs });
}

export async function seedLineItems(
  prisma: PrismaClient,
  engagementId: string,
  sourcePhaseId: string
) {
  return prisma.lineItem.createMany({
    data: [
      {
        engagementId,
        sourcePhaseId,
        tab: "BACKEND",
        task: "API Setup",
        description: "REST API scaffolding",
        hours: 8,
        conf: 5,
        lowHrs: 8,
        highHrs: 10,
        benchmarkLowHrs: 6,
        benchmarkHighHrs: 12,
      },
      {
        engagementId,
        sourcePhaseId,
        tab: "FRONTEND",
        task: "Header Component",
        description: "Responsive header",
        hours: 4,
        conf: 6,
        lowHrs: 4,
        highHrs: 4,
      },
    ],
  });
}

export async function truncateAll(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "LineItem", "Assumption", "RiskRegisterEntry", "PhaseArtefact", "Phase", "Engagement", "User" CASCADE`
  );
}
