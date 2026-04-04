import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getNextPhases, getPhaseLabel } from "@/lib/phase-chain";
import type { WorkflowPath } from "@/lib/phase-chain";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const phase = await prisma.phase.findUnique({
    where: { id },
    include: {
      engagement: {
        select: {
          id: true,
          createdById: true,
          workflowPath: true,
        },
      },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  if (phase.engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (phase.status !== "REVIEW") {
    return NextResponse.json(
      { error: `Phase cannot be approved: status is ${phase.status}, expected REVIEW` },
      { status: 422 }
    );
  }

  const updated = await prisma.phase.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  // Build current phase statuses map
  const allPhases = await prisma.phase.findMany({
    where: { engagementId: phase.engagement.id },
    select: { phaseNumber: true, status: true },
  });

  const phaseStatuses: Record<string, string> = {};
  for (const p of allPhases) {
    phaseStatuses[p.phaseNumber] = p.status;
  }
  // Override with just-approved status
  phaseStatuses[phase.phaseNumber] = "APPROVED";

  const workflowPath = (phase.engagement.workflowPath as WorkflowPath) ?? null;
  const nextPhases = getNextPhases(
    phase.phaseNumber,
    phaseStatuses,
    workflowPath
  ).map((num) => ({
    number: num,
    label: getPhaseLabel(num),
  }));

  return NextResponse.json({ phase: updated, nextPhases });
}
