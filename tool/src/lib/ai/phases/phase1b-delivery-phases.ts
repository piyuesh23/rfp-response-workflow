/**
 * Phase 1B: Delivery Phases Inference
 *
 * Runs after Phase 1 (TOR Assessment) when estimationMode === PHASED.
 * Uses AI to infer a set of logical delivery phases from TOR + research context.
 * Persists each inferred phase as a DeliveryPhase row (status: DRAFT) and
 * stores the raw inference as a DELIVERY_PHASES_INFERENCE PhaseArtefact.
 */
import Anthropic from "@anthropic-ai/sdk";
import { aiJsonCall } from "@/lib/ai/ai-with-retry";
import { DeliveryPhaseInferenceSchema } from "@/lib/ai/schemas/delivery-phases";
import { getDeliveryPhaseInferencePrompt } from "@/lib/ai/prompts/phase-prompts";
import { prisma } from "@/lib/db";
import { ArtefactType } from "@/generated/prisma/client";

const SONNET_MODEL = "claude-sonnet-4-20250514";

export interface Phase1BArgs {
  engagementId: string;
  phaseId: string;
  engagementType?: string | null;
}

export async function runPhase1BDeliveryPhases(args: Phase1BArgs) {
  const { engagementId, phaseId, engagementType } = args;

  // Gather context: TOR text from disk, Phase 1 artefact, Phase 0 artefact
  const workDir = `/data/engagements/${engagementId}`;
  const fs = await import("fs/promises");

  let torText: string | undefined;
  try {
    const files = await fs.readdir(`${workDir}/tor`).catch(() => [] as string[]);
    for (const f of files) {
      if (f.endsWith(".txt") || f.endsWith(".md")) {
        torText = await fs.readFile(`${workDir}/tor/${f}`, "utf-8").catch(() => undefined);
        if (torText) break;
      }
    }
  } catch {
    // tor dir may not exist if file was stored in S3; continue without
  }

  // Retrieve Phase 1 TOR assessment artefact from DB
  const torAssessmentArtefact = await prisma.phaseArtefact.findFirst({
    where: {
      phase: { engagementId },
      artefactType: ArtefactType.TOR_ASSESSMENT,
    },
    orderBy: { version: "desc" },
  });

  // Retrieve Phase 0 research artefact from DB
  const researchArtefact = await prisma.phaseArtefact.findFirst({
    where: {
      phase: { engagementId },
      artefactType: ArtefactType.RESEARCH,
    },
    orderBy: { version: "desc" },
  });

  const { system, user } = getDeliveryPhaseInferencePrompt({
    torText,
    torAssessment: torAssessmentArtefact?.contentMd ?? undefined,
    customerResearch: researchArtefact?.contentMd ?? undefined,
    engagementType: engagementType ?? undefined,
  });

  // Call AI with zod-validated JSON mode
  const result = await aiJsonCall({
    model: SONNET_MODEL,
    system,
    user,
    schema: DeliveryPhaseInferenceSchema,
    maxTokens: 4000,
    engagementId,
    phase: "1B_DELIVERY_PHASES",
  });

  // Persist each inferred phase as a DeliveryPhase row
  // First, clear any existing DRAFT phases for this engagement (re-run scenario)
  await prisma.deliveryPhase.deleteMany({
    where: { engagementId, status: "DRAFT" },
  });

  const createdPhases = await Promise.all(
    result.phases.map((phase, idx) =>
      prisma.deliveryPhase.create({
        data: {
          engagementId,
          ordinal: idx + 1,
          name: phase.name,
          summary: phase.summary,
          scopeBullets: phase.scopeBullets,
          targetDurationWeeks: phase.targetDurationWeeks ?? null,
          sourceType: "AI_INFERRED",
          status: "DRAFT",
        },
      })
    )
  );

  // Persist the raw inference as a DELIVERY_PHASES_INFERENCE PhaseArtefact
  const rawJson = JSON.stringify(result, null, 2);

  // Get next version
  const existing = await prisma.phaseArtefact.findMany({
    where: { phaseId, artefactType: ArtefactType.DELIVERY_PHASES_INFERENCE },
    orderBy: { version: "desc" },
    take: 1,
  });
  const nextVersion = (existing[0]?.version ?? 0) + 1;

  await prisma.phaseArtefact.create({
    data: {
      phaseId,
      artefactType: ArtefactType.DELIVERY_PHASES_INFERENCE,
      version: nextVersion,
      label: "delivery-phases-inference.json",
      contentMd: `\`\`\`json\n${rawJson}\n\`\`\``,
      metadata: { phaseCount: result.phases.length },
    },
  });

  return createdPhases;
}
