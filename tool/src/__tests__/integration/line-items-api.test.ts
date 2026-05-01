import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  seedUser,
  seedEngagement,
  seedPhase,
  seedLineItems,
  seedAssumptions,
  truncateAll,
} from "../../../prisma/test-helpers";
import { createTestPrisma } from "./setup/prisma-test-client";

let prisma: PrismaClient;

// Mock auth without touching the real next-auth flow.
vi.mock("@/lib/auth-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/auth-guard")>();
  return {
    ...mod,
    requireAuth: vi.fn().mockResolvedValue({
      user: { id: "test-user-id", email: "test@test.com", role: "MANAGER" },
    }),
  };
});

// Mock @/lib/db using async factory so the alias resolver works properly.
vi.mock("@/lib/db", async () => {
  const { createTestPrisma: mkPrisma } = await import("./setup/prisma-test-client");
  return { prisma: mkPrisma() };
});

beforeAll(() => {
  prisma = createTestPrisma();
});

afterEach(async () => {
  await truncateAll(prisma);
});

describe("GET /api/engagements/[id]/line-items", () => {
  it("returns line items with benchmarkRange and assumptionCodes", async () => {
    const user = await seedUser(prisma, { id: "test-user-id" });
    const engagement = await seedEngagement(prisma, user.id);
    const phase = await seedPhase(prisma, engagement.id, "1A");

    await seedLineItems(prisma, engagement.id, phase.id);
    await seedAssumptions(prisma, engagement.id, phase.id, 2);

    // Link the BACKEND line item to the first assumption so assumptionCodes is non-empty
    const lineItem = await prisma.lineItem.findFirst({
      where: { engagementId: engagement.id, tab: "BACKEND" },
    });
    const assumption = await prisma.assumption.findFirst({
      where: { engagementId: engagement.id },
    });
    if (lineItem && assumption) {
      await prisma.lineItem.update({
        where: { id: lineItem.id },
        data: { assumptionRefs: { connect: [{ id: assumption.id }] } },
      });
    }

    const { GET } = await import("@/app/api/engagements/[id]/line-items/route");
    const req = new Request(`http://localhost/api/engagements/${engagement.id}/line-items`);
    const response = await GET(req as never, { params: Promise.resolve({ id: engagement.id }) });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const backendItem = body.find((r: { tab: string }) => r.tab === "BACKEND");
    expect(backendItem).toBeDefined();

    // benchmarkRange formatted as "X-Yh" when both benchmark fields are set
    if (backendItem.benchmarkLowHrs != null && backendItem.benchmarkHighHrs != null) {
      expect(backendItem.benchmarkRange).toMatch(/^\d+-\d+h$/);
    }

    expect(typeof backendItem.assumptionCodes).toBe("string");
  });

  it("returns 404 when a VIEWER accesses a non-existent engagement", async () => {
    // VIEWER role does NOT get global access bypass (only ADMIN/MANAGER do).
    // engagement-access.ts:28 only grants global canRead to ADMIN/MANAGER.
    // For VIEWER: prisma.engagement.findUnique returns null → canRead: false → 404.
    const { requireAuth } = await import("@/lib/auth-guard");
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: { id: "viewer-id", email: "viewer@test.com", role: "VIEWER" },
    } as never);

    const { GET } = await import("@/app/api/engagements/[id]/line-items/route");
    const req = new Request("http://localhost/api/engagements/nonexistent-id/line-items");
    const response = await GET(req as never, { params: Promise.resolve({ id: "nonexistent-id" }) });
    expect(response.status).toBe(404);
  });
});
