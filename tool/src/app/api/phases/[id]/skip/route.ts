import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPhaseDef } from "@/lib/phase-chain";

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
}
