import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const phase = await prisma.phase.findUnique({
      where: { id },
      include: { engagement: { select: { id: true } } },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    await requireEngagementEdit(session, phase.engagement.id);

    if (phase.status === "RUNNING") {
      return NextResponse.json(
        { error: "Cannot reset a phase that is currently running" },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.phaseArtefact.deleteMany({ where: { phaseId: id } }),
      prisma.validationReport.deleteMany({
        where: { engagementId: phase.engagement.id, phaseNumber: phase.phaseNumber },
      }),
      prisma.engagementStageSummary.deleteMany({
        where: { engagementId: phase.engagement.id, phaseNumber: phase.phaseNumber },
      }),
      prisma.phase.update({
        where: { id },
        data: {
          status: "PENDING",
          startedAt: null,
          completedAt: null,
          agentSessionId: null,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
