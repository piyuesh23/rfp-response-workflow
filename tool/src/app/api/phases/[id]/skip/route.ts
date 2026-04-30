import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { getPhaseDef } from "@/lib/phase-chain";

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
      engagement: { select: { id: true, createdById: true } },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  await requireEngagementEdit(session, phase.engagement.id);

  // Only optional phases can be skipped
  const def = getPhaseDef(phase.phaseNumber);
  if (!def?.optional) {
    return NextResponse.json(
      { error: "This phase cannot be skipped" },
      { status: 422 }
    );
  }

  if (phase.status !== "PENDING") {
    return NextResponse.json(
      { error: `Phase cannot be skipped: status is ${phase.status}, expected PENDING` },
      { status: 422 }
    );
  }

  const updated = await prisma.phase.update({
    where: { id },
    data: { status: "SKIPPED" },
  });

  return NextResponse.json({ phase: updated });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
