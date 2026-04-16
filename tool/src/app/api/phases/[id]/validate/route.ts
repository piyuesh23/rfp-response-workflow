import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { validateProposal } from "@/lib/ai/validate-proposal";

export async function GET(
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

  if (phase.engagement.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
