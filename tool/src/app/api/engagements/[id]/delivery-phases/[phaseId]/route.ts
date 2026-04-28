import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { phaseId } = await params;
  const body = (await request.json()) as {
    name?: string;
    summary?: string;
    scopeBullets?: string[];
    targetDurationWeeks?: number | null;
    status?: "DRAFT" | "CONFIRMED";
    sourceType?: "AI_INFERRED" | "USER_EDITED" | "USER_DEFINED";
  };

  const updated = await prisma.deliveryPhase.update({
    where: { id: phaseId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.summary !== undefined && { summary: body.summary.trim() }),
      ...(body.scopeBullets !== undefined && { scopeBullets: body.scopeBullets }),
      ...(body.targetDurationWeeks !== undefined && { targetDurationWeeks: body.targetDurationWeeks }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.sourceType !== undefined && { sourceType: body.sourceType }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { phaseId } = await params;

  await prisma.deliveryPhase.delete({ where: { id: phaseId } });

  return NextResponse.json({ ok: true });
}
