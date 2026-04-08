import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: engagementId, phase: phaseNumber } = await params;

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
}
