import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  // Verify account exists
  const account = await prisma.account.findUnique({ where: { id }, select: { id: true } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Fetch all engagements for this account
  const engagements = await prisma.engagement.findMany({
    where: { accountId: id },
    select: {
      id: true,
      clientName: true,
      projectName: true,
      techStack: true,
      engagementType: true,
      status: true,
      outcome: true,
      lossReason: true,
      competitorWhoWon: true,
      estimatedDealValue: true,
      actualContractValue: true,
      importSource: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // -------------------------------------------------------------------------
  // Summary metrics
  // -------------------------------------------------------------------------
  const totalEngagements = engagements.length;

  const outcomeCounts: Record<string, number> = {};
  const lossReasonCounts: Record<string, number> = {};
  const competitorCounts: Record<string, number> = {};
  const techStackCounts: Record<string, number> = {};
  const engagementTypeCounts: Record<string, number> = {};

  let wonCount = 0;
  let lostCount = 0;
  let outcomesRecorded = 0;
  let totalPipelineValue = 0;
  let wonRevenue = 0;
  let pipelineCount = 0;

  for (const eng of engagements) {
    // Outcomes
    if (eng.outcome) {
      outcomesRecorded++;
      outcomeCounts[eng.outcome] = (outcomeCounts[eng.outcome] ?? 0) + 1;
      if (eng.outcome === "WON" || eng.outcome === "PARTIAL_WIN") wonCount++;
      if (eng.outcome === "LOST") lostCount++;
    }

    // Loss reasons
    if (eng.lossReason) {
      lossReasonCounts[eng.lossReason] = (lossReasonCounts[eng.lossReason] ?? 0) + 1;
    }

    // Competitors
    if (eng.competitorWhoWon) {
      competitorCounts[eng.competitorWhoWon] = (competitorCounts[eng.competitorWhoWon] ?? 0) + 1;
    }

    // Tech stack distribution
    techStackCounts[eng.techStack] = (techStackCounts[eng.techStack] ?? 0) + 1;

    // Engagement type distribution
    engagementTypeCounts[eng.engagementType] = (engagementTypeCounts[eng.engagementType] ?? 0) + 1;

    // Pipeline value
    if (eng.estimatedDealValue != null) {
      totalPipelineValue += eng.estimatedDealValue;
      pipelineCount++;
    }

    // Won revenue
    if ((eng.outcome === "WON" || eng.outcome === "PARTIAL_WIN") && eng.actualContractValue != null) {
      wonRevenue += eng.actualContractValue;
    }
  }

  const winRate = (wonCount + lostCount) > 0
    ? (wonCount / (wonCount + lostCount)) * 100
    : null;

  const avgDealSize = pipelineCount > 0 ? totalPipelineValue / pipelineCount : 0;

  const firstEngagement = engagements.length > 0
    ? engagements[engagements.length - 1].createdAt
    : null;
  const lastEngagement = engagements.length > 0
    ? engagements[0].createdAt
    : null;

  // -------------------------------------------------------------------------
  // AI investment (via PhaseExecution joined through engagementId)
  // -------------------------------------------------------------------------
  const engagementIds = engagements.map((e) => e.id);

  let totalAiCostUsd = 0;
  let totalTokensUsed = 0;
  let phasesRun = 0;

  const phaseByPhase: { phaseNumber: string; count: number; avgCost: number; totalCost: number }[] = [];

  if (engagementIds.length > 0) {
    const aiAggregate = await prisma.phaseExecution.aggregate({
      where: { engagementId: { in: engagementIds } },
      _sum: { estimatedCostUsd: true, totalTokens: true },
      _count: { id: true },
    });

    totalAiCostUsd = aiAggregate._sum.estimatedCostUsd ?? 0;
    totalTokensUsed = aiAggregate._sum.totalTokens ?? 0;
    phasesRun = aiAggregate._count.id;

    const phaseRows = await prisma.phaseExecution.groupBy({
      by: ["phaseNumber"],
      where: { engagementId: { in: engagementIds } },
      _count: { id: true },
      _avg: { estimatedCostUsd: true },
      _sum: { estimatedCostUsd: true },
    });

    for (const row of phaseRows) {
      phaseByPhase.push({
        phaseNumber: row.phaseNumber,
        count: row._count.id,
        avgCost: row._avg.estimatedCostUsd ?? 0,
        totalCost: row._sum.estimatedCostUsd ?? 0,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Financial by quarter
  // -------------------------------------------------------------------------
  const quarterMap = new Map<string, { pipelineValue: number; wonValue: number; engagementCount: number }>();

  for (const eng of engagements) {
    const d = eng.createdAt;
    const year = d.getFullYear();
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${year} Q${quarter}`;

    const existing = quarterMap.get(key) ?? { pipelineValue: 0, wonValue: 0, engagementCount: 0 };
    existing.engagementCount++;
    if (eng.estimatedDealValue != null) existing.pipelineValue += eng.estimatedDealValue;
    if ((eng.outcome === "WON" || eng.outcome === "PARTIAL_WIN") && eng.actualContractValue != null) {
      existing.wonValue += eng.actualContractValue;
    }
    quarterMap.set(key, existing);
  }

  const byQuarter = Array.from(quarterMap.entries())
    .map(([quarter, vals]) => ({ quarter, ...vals }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  // Financial by type
  const typeMap = new Map<string, { totalValue: number; count: number }>();
  for (const eng of engagements) {
    const existing = typeMap.get(eng.engagementType) ?? { totalValue: 0, count: 0 };
    existing.count++;
    if (eng.estimatedDealValue != null) existing.totalValue += eng.estimatedDealValue;
    typeMap.set(eng.engagementType, existing);
  }

  const byType = Array.from(typeMap.entries()).map(([type, vals]) => ({
    type,
    totalValue: vals.totalValue,
    avgValue: vals.count > 0 ? vals.totalValue / vals.count : 0,
    count: vals.count,
  }));

  // Competitors list sorted by frequency
  const competitors = Object.entries(competitorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    summary: {
      totalEngagements,
      winRate,
      outcomesRecorded,
      totalPipelineValue,
      wonRevenue,
      avgDealSize,
      totalAiCostUsd,
      totalTokensUsed,
      phasesRun,
      firstEngagement,
      lastEngagement,
    },
    outcomes: outcomeCounts,
    lossReasons: lossReasonCounts,
    competitors,
    techStackDistribution: techStackCounts,
    engagementTypeDistribution: engagementTypeCounts,
    timeline: engagements,
    financial: {
      byQuarter,
      byType,
    },
    aiInvestment: {
      totalCostUsd: totalAiCostUsd,
      totalTokens: totalTokensUsed,
      byPhase: phaseByPhase,
    },
  });
}
