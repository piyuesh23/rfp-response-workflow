import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getNextPhases, getPhaseLabel } from "@/lib/phase-chain";
import { populateTemplateAfterPhase1, populateTemplateAfterEstimate } from "@/lib/template-populator";
import { extractMetadataForPhase } from "@/lib/ai/metadata-extractor";
import type { WorkflowPath } from "@/lib/phase-chain";

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
      engagement: {
        select: {
          id: true,
          createdById: true,
          workflowPath: true,
        },
      },
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

  // Build current phase statuses map
  const allPhases = await prisma.phase.findMany({
    where: { engagementId: phase.engagement.id },
    select: { phaseNumber: true, status: true },
  });

  const phaseStatuses: Record<string, string> = {};
  for (const p of allPhases) {
    phaseStatuses[p.phaseNumber] = p.status;
  }
  // Override with just-approved status
  phaseStatuses[phase.phaseNumber] = "APPROVED";

  const workflowPath = (phase.engagement.workflowPath as WorkflowPath) ?? null;
  const nextPhases = getNextPhases(
    phase.phaseNumber,
    phaseStatuses,
    workflowPath
  ).map((num) => ({
    number: num,
    label: getPhaseLabel(num),
  }));

  // Re-extract metadata if artefact has content but zero/missing metadata
  try {
    const artefacts = await prisma.phaseArtefact.findMany({
      where: { phaseId: id },
      select: { id: true, contentMd: true, metadata: true },
    });
    for (const artefact of artefacts) {
      if (!artefact.contentMd) continue;
      const meta = artefact.metadata as Record<string, unknown> | null;
      const hasZeroHours =
        !meta ||
        (meta.totalHours &&
          typeof meta.totalHours === "object" &&
          (meta.totalHours as { low?: number }).low === 0 &&
          (meta.totalHours as { high?: number }).high === 0);
      const hasMissingMeta = !meta || Object.keys(meta).length === 0;

      if (hasZeroHours || hasMissingMeta) {
        const freshMeta = extractMetadataForPhase(phase.phaseNumber, artefact.contentMd);
        if (freshMeta) {
          await prisma.phaseArtefact.update({
            where: { id: artefact.id },
            data: { metadata: freshMeta as unknown as Record<string, never> },
          });
        }
      }
    }
  } catch {
    // Metadata re-extraction failure is non-fatal
  }

  // Populate Master Template tabs based on which phase was approved
  // Awaited so templateStatus is updated before the client fetches engagement data
  const engagementId = phase.engagement.id;
  try {
    if (phase.phaseNumber === "1") {
      await populateTemplateAfterPhase1(engagementId);
    } else if (phase.phaseNumber === "1A" || phase.phaseNumber === "3") {
      await populateTemplateAfterEstimate(engagementId, phase.phaseNumber);
    }
  } catch {
    // Template population failure is non-fatal
  }

  return NextResponse.json({ phase: updated, nextPhases });
}
