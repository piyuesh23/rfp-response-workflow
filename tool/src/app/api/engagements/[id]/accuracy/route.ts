/**
 * GET /api/engagements/[id]/accuracy
 *
 * Returns the latest ValidationReport per phase plus a weighted overall
 * accuracy score. Returns 404 when no ValidationReport rows exist for the
 * engagement (per Milestone 5 spec).
 *
 * Auth: engagement owner or ADMIN — matches the pattern in
 * `src/app/api/engagements/[id]/route.ts`.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  TRACKED_PHASES,
  computeOverallAccuracy,
  getLatestValidationReportsByPhase,
} from "@/lib/accuracy";

type PhasePayload = {
  score: number;
  status: "PASS" | "WARN" | "FAIL";
  gapCount: number;
  orphanCount: number;
  confFormulaViolations: number;
  noBenchmarkCount: number;
  ranAt: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  if (
    engagement.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reports = await getLatestValidationReportsByPhase(id);
  const overall = computeOverallAccuracy(reports);

  if (!overall) {
    return NextResponse.json(
      { error: "No validation reports available for this engagement" },
      { status: 404 }
    );
  }

  const byPhase: Record<string, PhasePayload | null> = {};
  let lastRunAt: Date | null = null;

  for (const phase of TRACKED_PHASES) {
    const report = reports[phase];
    if (!report) {
      byPhase[phase] = null;
      continue;
    }
    byPhase[phase] = {
      score: report.accuracyScore,
      status: report.overallStatus as "PASS" | "WARN" | "FAIL",
      gapCount: report.gapCount,
      orphanCount: report.orphanCount,
      confFormulaViolations: report.confFormulaViolations,
      noBenchmarkCount: report.noBenchmarkCount,
      ranAt: report.ranAt.toISOString(),
    };
    if (!lastRunAt || report.ranAt > lastRunAt) lastRunAt = report.ranAt;
  }

  return NextResponse.json({
    overall: { score: overall.score, status: overall.status },
    byPhase,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
  });
}
