import { NextRequest, NextResponse } from "next/server";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { getEngagementAccess, requireEngagementEdit } from "@/lib/engagement-access";
import { prisma } from "@/lib/db";
import { getGapFixQueue } from "@/lib/queue";
import { getLatestValidationReportsByPhase } from "@/lib/accuracy";

/**
 * GET — returns the currently in-progress (QUEUED or RUNNING) GapFixRun for
 * this engagement, or null. Used by the accuracy page's FixGapsButton to
 * restore streaming state after a page refresh.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await requireAuth();
  const { id: engagementId } = await params;
  const access = await getEngagementAccess(session, engagementId);
  if (!access.canRead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activeRun = await prisma.gapFixRun.findFirst({
    where: { engagementId, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json({ activeRun });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await requireAuth();
  const { id: engagementId } = await params;
  await requireEngagementEdit(session, engagementId);

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, techStack: true, techStackIsCustom: true, techStackCustom: true },
  });
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block if a fix-gaps run is already in progress
  const inProgress = await prisma.gapFixRun.findFirst({
    where: { engagementId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (inProgress) {
    return NextResponse.json(
      { error: "A fix-gaps run is already in progress", runId: inProgress.id },
      { status: 409 }
    );
  }

  // Snapshot current gap metrics from latest validation reports
  const reports = await getLatestValidationReportsByPhase(engagementId);
  const latestReport = Object.values(reports)
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime())[0];

  if (!latestReport) {
    return NextResponse.json(
      { error: "No validation report found. Run a phase first to generate accuracy data." },
      { status: 422 }
    );
  }

  const gapsBefore = {
    phaseNumber: latestReport.phaseNumber,
    gapCount: latestReport.gapCount,
    orphanCount: latestReport.orphanCount,
    confFormulaViolations: latestReport.confFormulaViolations,
    noBenchmarkCount: latestReport.noBenchmarkCount,
    details: latestReport.details,
  };

  const scoresBefore = Object.entries(reports)
    .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] != null)
    .map(([phase, rep]) => ({
      phaseNumber: phase,
      accuracyScore: rep.accuracyScore,
    }));

  const run = await prisma.gapFixRun.create({
    data: {
      engagementId,
      status: "QUEUED",
      gapsBefore,
      scoresBefore,
    },
  });

  const techStack = engagement.techStackIsCustom ? "OTHER" : engagement.techStack;
  const jobId = `fix-gaps-${run.id}`;

  await getGapFixQueue().add(
    "fix-gaps",
    { gapFixRunId: run.id, engagementId, techStack },
    { jobId }
  );

  await prisma.gapFixRun.update({
    where: { id: run.id },
    data: { jobId },
  });

  return NextResponse.json({ runId: run.id }, { status: 202 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
