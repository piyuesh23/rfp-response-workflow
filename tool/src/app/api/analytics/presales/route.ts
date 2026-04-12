import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(toYearMonth(d));
  }
  return months;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all engagements with needed fields
  const engagements = await prisma.engagement.findMany({
    select: {
      id: true,
      createdAt: true,
      submittedAt: true,
      outcome: true,
      lossReason: true,
      estimatedDealValue: true,
      actualContractValue: true,
      techStack: true,
      engagementType: true,
      rfpSource: true,
      accountId: true,
      account: {
        select: {
          id: true,
          canonicalName: true,
          industry: true,
        },
      },
    },
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const totalEngagements = engagements.length;

  const activeEngagements = engagements.filter((e) =>
    ["DRAFT", "IN_PROGRESS"].includes(
      // We need status — re-fetch or filter by outcome null
      // status not selected above; use outcome===null as proxy for active
      e.outcome === null ? "DRAFT" : "COMPLETED"
    )
  ).length;

  // Re-fetch with status for accurate active count
  const activeCount = await prisma.engagement.count({
    where: { status: { in: ["DRAFT", "IN_PROGRESS"] } },
  });

  const totalAccounts = await prisma.account.count();

  const pipelineAgg = await prisma.engagement.aggregate({
    where: { outcome: null },
    _sum: { estimatedDealValue: true },
  });
  const pipelineValue = pipelineAgg._sum.estimatedDealValue ?? 0;

  const wonAgg = await prisma.engagement.aggregate({
    where: { outcome: "WON" },
    _sum: { actualContractValue: true },
  });
  const wonValue = wonAgg._sum.actualContractValue ?? 0;

  const wonCount = engagements.filter((e) => e.outcome === "WON").length;
  const lostCount = engagements.filter((e) => e.outcome === "LOST").length;
  const overallWinRate =
    wonCount + lostCount > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100 * 10) / 10
      : 0;

  const summary = {
    totalEngagements,
    activeEngagements: activeCount,
    totalAccounts,
    pipelineValue,
    wonValue,
    overallWinRate,
  };

  // -------------------------------------------------------------------------
  // Win rate by month (last 12 months)
  // -------------------------------------------------------------------------
  const months = last12Months();
  const monthMap = new Map<string, { won: number; lost: number }>();
  for (const m of months) {
    monthMap.set(m, { won: 0, lost: 0 });
  }

  for (const e of engagements) {
    if (e.outcome !== "WON" && e.outcome !== "LOST") continue;
    const key = toYearMonth(e.createdAt);
    if (!monthMap.has(key)) continue;
    const entry = monthMap.get(key)!;
    if (e.outcome === "WON") entry.won++;
    else entry.lost++;
  }

  const winRateByMonth = months.map((month) => {
    const { won, lost } = monthMap.get(month)!;
    const total = won + lost;
    return {
      month,
      won,
      lost,
      total,
      winRate: total > 0 ? Math.round((won / total) * 100 * 10) / 10 : 0,
    };
  });

  // -------------------------------------------------------------------------
  // By industry
  // -------------------------------------------------------------------------
  const industryMap = new Map<
    string,
    { count: number; won: number; lost: number; totalValue: number }
  >();
  for (const e of engagements) {
    const industry = e.account?.industry ?? "UNKNOWN";
    if (!industryMap.has(industry)) {
      industryMap.set(industry, { count: 0, won: 0, lost: 0, totalValue: 0 });
    }
    const entry = industryMap.get(industry)!;
    entry.count++;
    if (e.outcome === "WON") entry.won++;
    if (e.outcome === "LOST") entry.lost++;
    entry.totalValue += e.actualContractValue ?? e.estimatedDealValue ?? 0;
  }

  const byIndustry = Array.from(industryMap.entries())
    .map(([industry, s]) => ({
      industry,
      count: s.count,
      won: s.won,
      lost: s.lost,
      winRate:
        s.won + s.lost > 0
          ? Math.round((s.won / (s.won + s.lost)) * 100 * 10) / 10
          : 0,
      totalValue: s.totalValue,
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // By tech stack
  // -------------------------------------------------------------------------
  const techMap = new Map<string, { count: number; won: number; lost: number }>();
  for (const e of engagements) {
    const ts = e.techStack;
    if (!techMap.has(ts)) techMap.set(ts, { count: 0, won: 0, lost: 0 });
    const entry = techMap.get(ts)!;
    entry.count++;
    if (e.outcome === "WON") entry.won++;
    if (e.outcome === "LOST") entry.lost++;
  }

  const byTechStack = Array.from(techMap.entries())
    .map(([techStack, s]) => ({
      techStack,
      count: s.count,
      won: s.won,
      lost: s.lost,
      winRate:
        s.won + s.lost > 0
          ? Math.round((s.won / (s.won + s.lost)) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // By RFP source
  // -------------------------------------------------------------------------
  const sourceMap = new Map<string, { count: number; won: number; lost: number }>();
  for (const e of engagements) {
    const src = e.rfpSource ?? "UNKNOWN";
    if (!sourceMap.has(src)) sourceMap.set(src, { count: 0, won: 0, lost: 0 });
    const entry = sourceMap.get(src)!;
    entry.count++;
    if (e.outcome === "WON") entry.won++;
    if (e.outcome === "LOST") entry.lost++;
  }

  const bySource = Array.from(sourceMap.entries())
    .map(([source, s]) => ({
      source,
      count: s.count,
      won: s.won,
      lost: s.lost,
      winRate:
        s.won + s.lost > 0
          ? Math.round((s.won / (s.won + s.lost)) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // Loss reasons
  // -------------------------------------------------------------------------
  const lossMap = new Map<string, number>();
  const lostEngagements = engagements.filter((e) => e.outcome === "LOST");
  for (const e of lostEngagements) {
    const reason = e.lossReason ?? "UNKNOWN";
    lossMap.set(reason, (lossMap.get(reason) ?? 0) + 1);
  }

  const totalLost = lostEngagements.length;
  const lossReasons = Array.from(lossMap.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalLost > 0 ? Math.round((count / totalLost) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // Top accounts
  // -------------------------------------------------------------------------
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      canonicalName: true,
      industry: true,
      engagements: {
        select: {
          outcome: true,
          actualContractValue: true,
          estimatedDealValue: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const topAccounts = accounts
    .map((acc) => {
      const engs = acc.engagements;
      const engagementCount = engs.length;
      const wonCount = engs.filter((e) => e.outcome === "WON").length;
      const lostCount = engs.filter((e) => e.outcome === "LOST").length;
      const winRate =
        wonCount + lostCount > 0
          ? Math.round((wonCount / (wonCount + lostCount)) * 100 * 10) / 10
          : 0;
      const totalValue = engs.reduce(
        (sum, e) => sum + (e.actualContractValue ?? e.estimatedDealValue ?? 0),
        0
      );
      const lastEngagementDate = engs[0]?.createdAt?.toISOString() ?? "";
      return {
        id: acc.id,
        name: acc.canonicalName,
        industry: acc.industry,
        engagementCount,
        wonCount,
        lostCount,
        winRate,
        totalValue,
        lastEngagementDate,
      };
    })
    .filter((a) => a.engagementCount > 0)
    .sort((a, b) => b.engagementCount - a.engagementCount)
    .slice(0, 15);

  // -------------------------------------------------------------------------
  // Monthly volume (last 12 months)
  // -------------------------------------------------------------------------
  const volumeMap = new Map<string, number>();
  for (const m of months) volumeMap.set(m, 0);
  for (const e of engagements) {
    const key = toYearMonth(e.createdAt);
    if (volumeMap.has(key)) volumeMap.set(key, (volumeMap.get(key) ?? 0) + 1);
  }

  const monthlyVolume = months.map((month) => ({
    month,
    count: volumeMap.get(month) ?? 0,
  }));

  // -------------------------------------------------------------------------
  // Cycle time (engagements with both createdAt and submittedAt)
  // -------------------------------------------------------------------------
  const cycleDays = engagements
    .filter((e) => e.submittedAt != null)
    .map((e) => {
      const ms = e.submittedAt!.getTime() - e.createdAt.getTime();
      return ms / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);

  const cycleTime =
    cycleDays.length > 0
      ? {
          avgDays:
            Math.round(
              (cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length) * 10
            ) / 10,
          medianDays:
            Math.round(
              (cycleDays[Math.floor(cycleDays.length / 2)] ?? 0) * 10
            ) / 10,
          minDays: Math.round((cycleDays[0] ?? 0) * 10) / 10,
          maxDays:
            Math.round((cycleDays[cycleDays.length - 1] ?? 0) * 10) / 10,
        }
      : { avgDays: 0, medianDays: 0, minDays: 0, maxDays: 0 };

  // -------------------------------------------------------------------------
  // AI cost summary
  // -------------------------------------------------------------------------
  const aiAgg = await prisma.phaseExecution.aggregate({
    _sum: {
      estimatedCostUsd: true,
      totalTokens: true,
    },
    _count: { id: true },
  });

  const totalCost = aiAgg._sum.estimatedCostUsd ?? 0;
  const totalTokens = aiAgg._sum.totalTokens ?? 0;
  const aiCost = {
    totalCost,
    avgCostPerEngagement:
      totalEngagements > 0
        ? Math.round((totalCost / totalEngagements) * 100) / 100
        : 0,
    totalTokens,
  };

  return NextResponse.json({
    summary,
    winRateByMonth,
    byIndustry,
    byTechStack,
    bySource,
    lossReasons,
    topAccounts,
    monthlyVolume,
    cycleTime,
    aiCost,
  });
}
