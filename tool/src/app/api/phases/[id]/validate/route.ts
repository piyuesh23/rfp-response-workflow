import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { validateProposal } from "@/lib/ai/validate-proposal";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await requireAuth();
  const { id } = await params;

  const phase = await prisma.phase.findUnique({
    where: { id },
    include: {
      engagement: {
        select: { id: true, techStack: true, createdById: true },
      },
      artefacts: {
        orderBy: { version: "desc" },
        take: 1,
        select: { contentMd: true, artefactType: true },
      },
    },
  });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  await requireEngagementEdit(session, phase.engagement.id);

  const artefact = phase.artefacts[0];
  if (!artefact?.contentMd) {
    return NextResponse.json({ error: "No artefact content to validate" }, { status: 422 });
  }

  const isEstimatePhase = phase.phaseNumber === "1A" || phase.phaseNumber === "3";
  const isProposalPhase = phase.phaseNumber === "5";

  if (isEstimatePhase) {
    const report = await validateEstimateFull(
      artefact.contentMd,
      phase.engagement.techStack,
      phase.engagement.id,
      phase.phaseNumber
    );
    return NextResponse.json({ type: "estimate", report });
  }

  if (isProposalPhase) {
    const report = await validateProposal(artefact.contentMd, phase.engagement.id);
    return NextResponse.json({ type: "proposal", report });
  }

  return NextResponse.json({ error: "Validation not supported for this phase type" }, { status: 422 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
