import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRoles, guardErrorStatus } from "@/lib/auth-guard";
import type { Industry, Region, AccountTier } from "@/generated/prisma/client";

export async function GET() {
  try {
    await requireAuth();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const accounts = await prisma.account.findMany({
    orderBy: { canonicalName: "asc" },
    include: {
      _count: { select: { engagements: true } },
    },
  });

  if (accounts.length === 0) {
    return NextResponse.json(accounts);
  }

  // Fetch engagement aggregations per account
  const accountIds = accounts.map((a) => a.id);

  // All engagements with outcome/value fields grouped by accountId
  const engagements = await prisma.engagement.findMany({
    where: { accountId: { in: accountIds } },
    select: {
      accountId: true,
      outcome: true,
      estimatedDealValue: true,
      actualContractValue: true,
      techStack: true,
      createdAt: true,
    },
  });

  // Build per-account stats
  type AccountStats = {
    wonCount: number;
    lostCount: number;
    outcomesRecorded: number;
    totalDealValue: number;
    wonRevenue: number;
    lastEngagementDate: Date | null;
    techStackCounts: Record<string, number>;
  };

  const statsMap = new Map<string, AccountStats>();

  for (const eng of engagements) {
    if (!eng.accountId) continue;
    const existing = statsMap.get(eng.accountId) ?? {
      wonCount: 0,
      lostCount: 0,
      outcomesRecorded: 0,
      totalDealValue: 0,
      wonRevenue: 0,
      lastEngagementDate: null,
      techStackCounts: {},
    };

    if (eng.outcome) {
      existing.outcomesRecorded++;
      if (eng.outcome === "WON" || eng.outcome === "PARTIAL_WIN") existing.wonCount++;
      if (eng.outcome === "LOST") existing.lostCount++;
    }

    if (eng.estimatedDealValue != null) existing.totalDealValue += eng.estimatedDealValue;

    if ((eng.outcome === "WON" || eng.outcome === "PARTIAL_WIN") && eng.actualContractValue != null) {
      existing.wonRevenue += eng.actualContractValue;
    }

    if (!existing.lastEngagementDate || eng.createdAt > existing.lastEngagementDate) {
      existing.lastEngagementDate = eng.createdAt;
    }

    existing.techStackCounts[eng.techStack] = (existing.techStackCounts[eng.techStack] ?? 0) + 1;

    statsMap.set(eng.accountId, existing);
  }

  const enriched = accounts.map((acc) => {
    const stats = statsMap.get(acc.id);
    if (!stats) {
      return {
        ...acc,
        winRate: null,
        outcomesRecorded: 0,
        totalDealValue: 0,
        wonRevenue: 0,
        lastEngagementDate: null,
        primaryTechStack: null,
      };
    }

    const winRate =
      stats.wonCount + stats.lostCount > 0
        ? (stats.wonCount / (stats.wonCount + stats.lostCount)) * 100
        : null;

    const primaryTechStack =
      Object.entries(stats.techStackCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    return {
      ...acc,
      winRate,
      outcomesRecorded: stats.outcomesRecorded,
      totalDealValue: stats.totalDealValue,
      wonRevenue: stats.wonRevenue,
      lastEngagementDate: stats.lastEngagementDate,
      primaryTechStack,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  try {
    await requireRoles("ADMIN", "MANAGER");
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const body = await request.json();
  const {
    canonicalName,
    industry,
    region,
    accountTier,
    primaryContact,
    contactEmail,
    notes,
  } = body as {
    canonicalName: string;
    industry?: Industry;
    region?: Region;
    accountTier?: AccountTier;
    primaryContact?: string;
    contactEmail?: string;
    notes?: string;
  };

  if (!canonicalName || typeof canonicalName !== "string" || !canonicalName.trim()) {
    return NextResponse.json(
      { error: "canonicalName is required" },
      { status: 400 }
    );
  }

  // Case-insensitive uniqueness check
  const existing = await prisma.account.findFirst({
    where: {
      canonicalName: { equals: canonicalName.trim(), mode: "insensitive" },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with this name already exists" },
      { status: 409 }
    );
  }

  const account = await prisma.account.create({
    data: {
      canonicalName: canonicalName.trim(),
      ...(industry !== undefined && { industry }),
      ...(region !== undefined && { region }),
      ...(accountTier !== undefined && { accountTier }),
      ...(primaryContact !== undefined && { primaryContact }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      _count: { select: { engagements: true } },
    },
  });

  return NextResponse.json(account, { status: 201 });
}
