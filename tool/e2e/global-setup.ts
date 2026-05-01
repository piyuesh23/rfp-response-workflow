import { PrismaClient } from "../src/generated/prisma/client";
import {
  seedUser,
  seedEngagement,
  seedPhase,
  seedAssumptions,
  seedLineItems,
  truncateAll,
} from "../prisma/test-helpers";

let prismaE2E: PrismaClient | null = null;

export default async function globalSetup() {
  const dbUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[e2e/global-setup] No DATABASE_URL — skipping seed");
    return;
  }

  prismaE2E = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  await truncateAll(prismaE2E);

  const user = await seedUser(prismaE2E, {
    email: "e2e@test.com",
    id: "e2e-user-1",
  });
  const engagement = await seedEngagement(prismaE2E, user.id, {
    id: "e2e-engagement-1",
    clientName: "E2E Test Client",
  });
  const phase = await seedPhase(prismaE2E, engagement.id, "1A");
  await seedAssumptions(prismaE2E, engagement.id, phase.id, 3);
  await seedLineItems(prismaE2E, engagement.id, phase.id);

  // Write engagement ID to env so tests can reference it
  process.env.E2E_ENGAGEMENT_ID = engagement.id;
}
