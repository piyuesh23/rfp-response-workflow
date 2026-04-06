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

  return NextResponse.json({ totals, byUser, byPhase, daily, byModel, byEngagement });
}
