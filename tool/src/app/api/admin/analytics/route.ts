import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  // Total engagements
  const totalEngagements = await prisma.engagement.count();

  // Aggregate over all PhaseExecution rows
  const aggregate = await prisma.phaseExecution.aggregate({
    _sum: {
      totalTokens: true,
      estimatedCostUsd: true,
    },
    _count: {
      id: true,
    },
  });

  const totals = {
    totalEngagements,
    phasesRun: aggregate._count.id,
    tokensConsumed: aggregate._sum.totalTokens ?? 0,
    estimatedCostUsd: aggregate._sum.estimatedCostUsd ?? 0,
  };

  // Per-user stats — join with User to get name
  const userRows = await prisma.phaseExecution.groupBy({
    by: ["userId"],
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCostUsd: true },
  });

  // Fetch engagement counts per user
  const engagementsByUser = await prisma.engagement.groupBy({
    by: ["createdById"],
    _count: { id: true },
  });
  const engCountMap = new Map(
    engagementsByUser.map((r) => [r.createdById, r._count.id])
  );

  // Fetch user names
  const userIds = userRows.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const byUser = userRows.map((row) => {
    const user = userMap.get(row.userId);
    return {
      userId: row.userId,
      userName: user?.name ?? row.userId,
      userEmail: user?.email ?? "",
      engagements: engCountMap.get(row.userId) ?? 0,
      phasesRun: row._count.id,
      totalTokens: row._sum.totalTokens ?? 0,
      estimatedCost: row._sum.estimatedCostUsd ?? 0,
    };
  });

  // Per-phase stats
  const phaseRows = await prisma.phaseExecution.groupBy({
    by: ["phaseNumber", "status"],
    _count: { id: true },
    _avg: { durationMs: true, totalTokens: true, estimatedCostUsd: true },
  });

  // Merge by phaseNumber (aggregate completed vs failed)
  const phaseMap = new Map<
    string,
    {
      phaseNumber: string;
      count: number;
      completedCount: number;
      sumDurationMs: number;
      sumTokens: number;
      sumCost: number;
    }
  >();

  for (const row of phaseRows) {
    const existing = phaseMap.get(row.phaseNumber) ?? {
      phaseNumber: row.phaseNumber,
      count: 0,
      completedCount: 0,
      sumDurationMs: 0,
      sumTokens: 0,
      sumCost: 0,
    };
    existing.count += row._count.id;
    if (row.status === "COMPLETED") {
      existing.completedCount += row._count.id;
      existing.sumDurationMs += (row._avg.durationMs ?? 0) * row._count.id;
      existing.sumTokens += (row._avg.totalTokens ?? 0) * row._count.id;
      existing.sumCost += (row._avg.estimatedCostUsd ?? 0) * row._count.id;
    }
    phaseMap.set(row.phaseNumber, existing);
  }

  const byPhase = Array.from(phaseMap.values()).map((p) => ({
    phaseNumber: p.phaseNumber,
    count: p.count,
    avgDurationMs:
      p.completedCount > 0 ? Math.round(p.sumDurationMs / p.completedCount) : 0,
    avgTokens:
      p.completedCount > 0 ? Math.round(p.sumTokens / p.completedCount) : 0,
    avgCost:
      p.completedCount > 0 ? p.sumCost / p.completedCount : 0,
    successRate:
      p.count > 0 ? Math.round((p.completedCount / p.count) * 100) : 0,
  }));

  // Daily stats for last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const dailyRows = await prisma.phaseExecution.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, totalTokens: true, estimatedCostUsd: true },
  });

  const dailyMap = new Map<
    string,
    { phasesRun: number; totalTokens: number; estimatedCost: number }
  >();

  for (const row of dailyRows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(date) ?? {
      phasesRun: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
    existing.phasesRun++;
    existing.totalTokens += row.totalTokens;
    existing.estimatedCost += row.estimatedCostUsd ?? 0;
    dailyMap.set(date, existing);
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Per-model stats
  const modelRows = await prisma.phaseExecution.groupBy({
    by: ["modelId"],
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCostUsd: true },
  });

  const byModel = modelRows
    .filter((r) => r.modelId !== null)
    .map((row) => ({
      modelId: row.modelId as string,
      totalTokens: row._sum.totalTokens ?? 0,
      estimatedCost: row._sum.estimatedCostUsd ?? 0,
      count: row._count.id,
    }));

  // Per-engagement stats — top 20 most expensive
  const engagementRows = await prisma.phaseExecution.groupBy({
    by: ["engagementId"],
    _count: { id: true },
    _sum: { totalTokens: true, estimatedCostUsd: true },
    orderBy: { _sum: { estimatedCostUsd: "desc" } },
    take: 20,
  });

  const engagementIds = engagementRows.map((r) => r.engagementId);
  const engagements = await prisma.engagement.findMany({
    where: { id: { in: engagementIds } },
    select: { id: true, clientName: true, projectName: true, techStack: true },
  });
  const engMap = new Map(engagements.map((e) => [e.id, e]));

  const byEngagement = engagementRows.map((row) => {
    const eng = engMap.get(row.engagementId);
    return {
      engagementId: row.engagementId,
      clientName: eng?.clientName ?? "Unknown",
      projectName: eng?.projectName ?? null,
      techStack: eng?.techStack ?? null,
      phasesRun: row._count.id,
      totalTokens: row._sum.totalTokens ?? 0,
      estimatedCost: row._sum.estimatedCostUsd ?? 0,
    };
  });

  // ---------------------------------------------------------------------------
  // Business intelligence — cross-account analytics
  // ---------------------------------------------------------------------------

  // Fetch all engagements with outcome/business fields + account
  const allEngagements = await prisma.engagement.findMany({
    select: {
      id: true,
      techStack: true,
      engagementType: true,
      outcome: true,
      lossReason: true,
      estimatedDealValue: true,
      financialProposalValue: true,
      actualContractValue: true,
      competitorWhoWon: true,
      importSource: true,
      createdAt: true,
      accountId: true,
      account: {
        select: { id: true, canonicalName: true, industry: true },
      },
    },
  });

  // Helper: determine deal value (prefer actual > financial > estimated)
  function dealValue(e: {
    actualContractValue: number | null;
    financialProposalValue: number | null;
    estimatedDealValue: number | null;
  }): number {
    return e.actualContractValue ?? e.financialProposalValue ?? e.estimatedDealValue ?? 0;
  }

  // 1. byIndustry
  const industryMap = new Map<
    string,
    { total: number; won: number; lost: number; totalDealValue: number }
  >();
  for (const e of allEngagements) {
    const industry = e.account?.industry ?? "UNKNOWN";
    const existing = industryMap.get(industry) ?? { total: 0, won: 0, lost: 0, totalDealValue: 0 };
    existing.total++;
    if (e.outcome === "WON") existing.won++;
    if (e.outcome === "LOST") existing.lost++;
    existing.totalDealValue += dealValue(e);
    industryMap.set(industry, existing);
  }
  const byIndustry = Array.from(industryMap.entries())
    .map(([industry, stats]) => ({
      industry,
      total: stats.total,
      won: stats.won,
      lost: stats.lost,
      winRate:
        stats.won + stats.lost > 0
          ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
          : 0,
      totalDealValue: stats.totalDealValue,
    }))
    .sort((a, b) => b.total - a.total);

  // 2. byTechStack
  const techStackMap = new Map<
    string,
    { total: number; won: number; lost: number; sumDealValue: number; countWithValue: number }
  >();
  for (const e of allEngagements) {
    const stack = e.techStack as string;
    const existing = techStackMap.get(stack) ?? { total: 0, won: 0, lost: 0, sumDealValue: 0, countWithValue: 0 };
    existing.total++;
    if (e.outcome === "WON") existing.won++;
    if (e.outcome === "LOST") existing.lost++;
    const dv = dealValue(e);
    if (dv > 0) {
      existing.sumDealValue += dv;
      existing.countWithValue++;
    }
    techStackMap.set(stack, existing);
  }
  const byTechStack = Array.from(techStackMap.entries())
    .map(([techStack, stats]) => ({
      techStack,
      total: stats.total,
      won: stats.won,
      lost: stats.lost,
      winRate:
        stats.won + stats.lost > 0
          ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
          : 0,
      avgDealValue:
        stats.countWithValue > 0 ? stats.sumDealValue / stats.countWithValue : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 3. byEngagementType
  const engTypeMap = new Map<
    string,
    { total: number; won: number; lost: number }
  >();
  for (const e of allEngagements) {
    const type = e.engagementType as string;
    const existing = engTypeMap.get(type) ?? { total: 0, won: 0, lost: 0 };
    existing.total++;
    if (e.outcome === "WON") existing.won++;
    if (e.outcome === "LOST") existing.lost++;
    engTypeMap.set(type, existing);
  }
  const byEngagementType = Array.from(engTypeMap.entries())
    .map(([type, stats]) => ({
      type,
      total: stats.total,
      won: stats.won,
      lost: stats.lost,
      winRate:
        stats.won + stats.lost > 0
          ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
          : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 4. topAccounts
  const accountEngMap = new Map<
    string,
    { engagements: number; won: number; lost: number; pipeline: number; wonRevenue: number; accountName: string; industry: string }
  >();
  for (const e of allEngagements) {
    if (!e.accountId || !e.account) continue;
    const existing = accountEngMap.get(e.accountId) ?? {
      engagements: 0,
      won: 0,
      lost: 0,
      pipeline: 0,
      wonRevenue: 0,
      accountName: e.account.canonicalName,
      industry: e.account.industry as string,
    };
    existing.engagements++;
    const dv = dealValue(e);
    existing.pipeline += dv;
    if (e.outcome === "WON") {
      existing.won++;
      existing.wonRevenue += dv;
    }
    if (e.outcome === "LOST") existing.lost++;
    accountEngMap.set(e.accountId, existing);
  }
  const topAccounts = Array.from(accountEngMap.entries())
    .map(([accountId, stats]) => ({
      accountId,
      accountName: stats.accountName,
      industry: stats.industry,
      engagements: stats.engagements,
      winRate:
        stats.won + stats.lost > 0
          ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
          : 0,
      pipelineValue: stats.pipeline,
      wonRevenue: stats.wonRevenue,
    }))
    .sort((a, b) => b.pipelineValue - a.pipelineValue)
    .slice(0, 20);

  // 5. monthlyVolume — last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const monthlyMap = new Map<string, { count: number; imported: number; native: number }>();
  for (const e of allEngagements) {
    if (e.createdAt < twelveMonthsAgo) continue;
    const month = e.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    const existing = monthlyMap.get(month) ?? { count: 0, imported: 0, native: 0 };
    existing.count++;
    if (e.importSource) existing.imported++;
    else existing.native++;
    monthlyMap.set(month, existing);
  }
  const monthlyVolume = Array.from(monthlyMap.entries())
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 6. lossReasons
  const lossReasonMap: Record<string, number> = {};
  for (const e of allEngagements) {
    if (e.outcome === "LOST" && e.lossReason) {
      const key = e.lossReason as string;
      lossReasonMap[key] = (lossReasonMap[key] ?? 0) + 1;
    }
  }

  // 7. topCompetitors
  const competitorMap = new Map<
    string,
    { count: number; winAgainst: number; lossAgainst: number }
  >();
  for (const e of allEngagements) {
    if (!e.competitorWhoWon) continue;
    const name = e.competitorWhoWon;
    const existing = competitorMap.get(name) ?? { count: 0, winAgainst: 0, lossAgainst: 0 };
    existing.count++;
    // If we lost to them, they won against us; if we won, we beat them
    if (e.outcome === "LOST") existing.lossAgainst++;
    else if (e.outcome === "WON") existing.winAgainst++;
    competitorMap.set(name, existing);
  }
  const topCompetitors = Array.from(competitorMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // 8. summary
  const withOutcome = allEngagements.filter((e) => e.outcome === "WON" || e.outcome === "LOST");
  const wonEngagements = allEngagements.filter((e) => e.outcome === "WON");
  const totalPipeline = allEngagements.reduce((sum, e) => sum + dealValue(e), 0);
  const totalWonRevenue = wonEngagements.reduce((sum, e) => sum + dealValue(e), 0);
  const allAccountIds = await prisma.account.count();
  const businessSummary = {
    totalAccounts: allAccountIds,
    totalEngagements: allEngagements.length,
    engagementsWithOutcome: withOutcome.length,
    overallWinRate:
      withOutcome.length > 0
        ? Math.round((wonEngagements.length / withOutcome.length) * 100)
        : 0,
    totalPipeline,
    totalWonRevenue,
    avgDealSize:
      allEngagements.length > 0 ? totalPipeline / allEngagements.length : 0,
    importedEngagements: allEngagements.filter((e) => e.importSource).length,
  };

  const business = {
    byIndustry,
    byTechStack,
    byEngagementType,
    topAccounts,
    monthlyVolume,
    lossReasons: lossReasonMap,
    topCompetitors,
    summary: businessSummary,
  };

  return NextResponse.json({ totals, byUser, byPhase, daily, byModel, byEngagement, business });
}
