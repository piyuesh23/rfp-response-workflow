import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { phaseQueue } from "@/lib/queue";

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
        select: { id: true, techStack: true, createdById: true },
      },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  if (phase.engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (phase.status !== "PENDING") {
    return NextResponse.json(
      { error: `Phase cannot run: status is ${phase.status}, expected PENDING` },
      { status: 422 }
    );
  }

  // Check prior phase dependency (phases ordered: 0, 1, 1A, 2, 3, 4, 5)
  const phaseOrder = ["0", "1", "1A", "2", "3", "4", "5"];
  const currentIndex = phaseOrder.indexOf(phase.phaseNumber);

  if (currentIndex > 0) {
    const priorPhaseNumber = phaseOrder[currentIndex - 1];
    const priorPhase = await prisma.phase.findUnique({
      where: {
        engagementId_phaseNumber: {
          engagementId: phase.engagementId,
          phaseNumber: priorPhaseNumber,
        },
      },
      select: { status: true },
    });

    if (priorPhase && priorPhase.status !== "APPROVED" && priorPhase.status !== "SKIPPED") {
      return NextResponse.json(
        {
          error: `Prior phase (${priorPhaseNumber}) must be APPROVED or SKIPPED before running this phase`,
        },
        { status: 422 }
      );
    }
  }

  const phaseNumberAsInt = currentIndex; // use index as numeric representation for queue

  const job = await phaseQueue.add(
    `phase-${phase.phaseNumber}`,
    {
      phaseId: phase.id,
      engagementId: phase.engagementId,
      phaseNumber: phaseNumberAsInt,
      techStack: phase.engagement.techStack,
    },
    { jobId: `phase-${phase.id}` }
  );

  // Mark phase as RUNNING
  await prisma.phase.update({
    where: { id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
