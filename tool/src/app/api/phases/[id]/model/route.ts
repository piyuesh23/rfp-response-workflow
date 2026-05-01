import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { ALLOWED_MODEL_VALUES } from "@/lib/model-overrides";

export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const { modelOverride } = body as { modelOverride: string | null };

    // Validate: if non-null, must be a known model value
    if (modelOverride !== null && modelOverride !== undefined) {
      if (!ALLOWED_MODEL_VALUES.includes(modelOverride as (typeof ALLOWED_MODEL_VALUES)[number])) {
        return NextResponse.json({ error: "Invalid model" }, { status: 422 });
      }
    }

    const updated = await prisma.phase.update({
      where: { id },
      data: { modelOverride: modelOverride ?? null },
      select: { id: true, phaseNumber: true, modelOverride: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
