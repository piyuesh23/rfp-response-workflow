import { NextRequest, NextResponse } from "next/server";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { prisma } from "@/lib/db";
import { validateEstimate } from "@/lib/ai/validate-estimate";

/**
 * POST /api/engagements/[id]/phases/[phase]/validate
 *
 * Validates the latest estimate artefact for the given phase against
 * benchmark data. Returns a pass/warn/fail report per line item.
 * No AI calls — pure TypeScript validation.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
  const session = await requireAuth();
  const { id: engagementId, phase: phaseNumber } = await params;
  await requireEngagementEdit(session, engagementId);

  // Find the phase and its latest artefact
  const phase = await prisma.phase.findFirst({
    where: { engagementId, phaseNumber },
    include: {
      artefacts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { contentMd: true },
      },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  const artefact = phase.artefacts[0];
  if (!artefact?.contentMd) {
    return NextResponse.json(
      { error: "No artefact content to validate" },
      { status: 404 }
    );
  }

  const report = await validateEstimate(artefact.contentMd);

  return NextResponse.json(report);
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
