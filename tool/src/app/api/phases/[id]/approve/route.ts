import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getNextPhase, canAutoStart, PHASE_ORDER } from "@/lib/phase-chain";
import { PHASE_LABELS } from "@/components/phase/PhaseCard";

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
      engagement: { select: { createdById: true } },
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

  const nextNumber = getNextPhase(phase.phaseNumber);
  const nextPhase = nextNumber !== null
    ? {
        number: nextNumber,
        label: PHASE_LABELS[nextNumber] ?? `Phase ${nextNumber}`,
        canAutoStart: canAutoStart(nextNumber),
      }
    : null;

  return NextResponse.json({ phase: updated, nextPhase });
}
