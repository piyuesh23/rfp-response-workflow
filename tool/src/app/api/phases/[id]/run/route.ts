import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { phaseQueue } from "@/lib/queue";
import { canStartPhase } from "@/lib/phase-chain";
import type { WorkflowPath } from "@/lib/phase-chain";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await requireAuth();
  const { id } = await params;

  const phase = await prisma.phase.findUnique({
    where: { id },
    include: {
      engagement: {
        select: { id: true, techStack: true, createdById: true, workflowPath: true },
      },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  await requireEngagementEdit(session, phase.engagement.id);

  if (phase.status !== "PENDING" && phase.status !== "FAILED") {
    return NextResponse.json(
      { error: `Phase cannot run: status is ${phase.status}, expected PENDING or FAILED` },
      { status: 422 }
    );
  }

  // Graph-based dependency check
  const allPhases = await prisma.phase.findMany({
    where: { engagementId: phase.engagementId },
    select: { phaseNumber: true, status: true },
  });

  const phaseStatuses: Record<string, string> = {};
  for (const p of allPhases) {
    phaseStatuses[p.phaseNumber] = p.status;
  }

  const workflowPath = (phase.engagement.workflowPath as WorkflowPath) ?? null;
  const { canStart, reason } = canStartPhase(
    phase.phaseNumber,
    phaseStatuses,
    workflowPath
  );

  if (!canStart) {
    return NextResponse.json(
      { error: reason ?? "Phase cannot start" },
      { status: 422 }
    );
  }

  // Extract revision feedback stored in agentSessionId by the revise endpoint
  let revisionFeedback: string | undefined;
  if (phase.agentSessionId) {
    try {
      const sessionMeta = JSON.parse(phase.agentSessionId);
      if (sessionMeta.revisionFeedback) {
        revisionFeedback = sessionMeta.revisionFeedback;
      }
    } catch {
      // Not JSON — plain session ID, no revision feedback
    }
  }

  const job = await phaseQueue.add(
    `phase-${phase.phaseNumber}`,
    {
      phaseId: phase.id,
      engagementId: phase.engagementId,
      phaseNumber: phase.phaseNumber,
      techStack: phase.engagement.techStack,
      ...(revisionFeedback ? { revisionFeedback } : {}),
    },
    { jobId: `phase-${phase.id}-${Date.now()}` }
  );

  // Mark phase as RUNNING
  await prisma.phase.update({
    where: { id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
