/**
 * Phase 5B: Project Plan Generation
 *
 * Runs after Phase 5 (Technical Proposal). Aggregates LineItem totals per
 * delivery phase and generates a standalone Project Plan document.
 * Persisted as PhaseArtefact (type: PROJECT_PLAN, deliveryPhaseId: null).
 */
import Anthropic from "@anthropic-ai/sdk";
import { getProjectPlanPrompt, type DeliveryPhaseData } from "@/lib/ai/prompts/phase-prompts";
import { prisma } from "@/lib/db";
import { ArtefactType } from "@/generated/prisma/client";

const SONNET_MODEL = "claude-sonnet-4-20250514";

export interface Phase5BArgs {
  engagementId: string;
  phaseId: string;
  engagementType?: string | null;
}

export async function runPhase5BProjectPlan(args: Phase5BArgs) {
  const { engagementId, phaseId, engagementType } = args;

  // Fetch engagement with delivery phases and line items
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
    select: {
      estimationMode: true,
      deliveryPhases: {
        orderBy: { ordinal: "asc" },
      },
      lineItems: {
        select: {
          deliveryPhaseId: true,
          lowHrs: true,
          highHrs: true,
        },
      },
      assumptions: {
        select: { text: true, impactIfWrong: true },
        take: 20,
      },
      risks: {
        select: { task: true, risk: true, recommendedAction: true, conf: true },
        take: 20,
      },
    },
  });

  const mode =
    engagement.estimationMode === "PHASED" ? "PHASED" : "BIG_BANG";

  // Aggregate line item totals per delivery phase
  const phaseMap = new Map<string, { lowHrs: number; highHrs: number }>();
  for (const li of engagement.lineItems) {
    if (li.deliveryPhaseId) {
      const existing = phaseMap.get(li.deliveryPhaseId) ?? { lowHrs: 0, highHrs: 0 };
      existing.lowHrs += li.lowHrs;
      existing.highHrs += li.highHrs;
      phaseMap.set(li.deliveryPhaseId, existing);
    }
  }

  const deliveryPhases: DeliveryPhaseData[] = engagement.deliveryPhases.map((dp) => {
    const totals = phaseMap.get(dp.id) ?? { lowHrs: 0, highHrs: 0 };
    return {
      name: dp.name,
      summary: dp.summary,
      scopeBullets: dp.scopeBullets as string[],
      ordinal: dp.ordinal,
      targetDurationWeeks: dp.targetDurationWeeks,
      lowHrsTotal: totals.lowHrs,
      highHrsTotal: totals.highHrs,
    };
  });

  // Build assumptions and risks summary strings
  const assumptionsSummary = engagement.assumptions
    .map((a) => `- ${a.text} (Impact: ${a.impactIfWrong})`)
    .join("\n");

  const risksSummary = engagement.risks
    .map((r) => `- **${r.task}** (Conf ${r.conf}): ${r.risk} → ${r.recommendedAction}`)
    .join("\n");

  // Build line item totals summary
  let totalLow = 0;
  let totalHigh = 0;
  for (const li of engagement.lineItems) {
    totalLow += li.lowHrs;
    totalHigh += li.highHrs;
  }
  const lineItemSummary = `Total Estimated Effort: ${totalLow.toFixed(0)} – ${totalHigh.toFixed(0)} hours\n${
    deliveryPhases.length > 0
      ? deliveryPhases
          .map((p) => `- ${p.name}: ${p.lowHrsTotal?.toFixed(0) ?? "TBD"} – ${p.highHrsTotal?.toFixed(0) ?? "TBD"} hrs`)
          .join("\n")
      : ""
  }`;

  const promptText = getProjectPlanPrompt({
    engagementType: engagementType ?? undefined,
    mode,
    deliveryPhases: deliveryPhases.length > 0 ? deliveryPhases : undefined,
    lineItemSummary,
    assumptions: assumptionsSummary,
    risks: risksSummary,
  });

  // Call AI to generate the project plan
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: promptText,
      },
    ],
  });

  const contentMd =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Get next version
  const existing = await prisma.phaseArtefact.findMany({
    where: { phaseId, artefactType: ArtefactType.PROJECT_PLAN },
    orderBy: { version: "desc" },
    take: 1,
  });
  const nextVersion = (existing[0]?.version ?? 0) + 1;

  const artefact = await prisma.phaseArtefact.create({
    data: {
      phaseId,
      artefactType: ArtefactType.PROJECT_PLAN,
      version: nextVersion,
      label: "project-plan.md",
      contentMd,
      metadata: {
        mode,
        phaseCount: deliveryPhases.length,
        totalLowHrs: totalLow,
        totalHighHrs: totalHigh,
      },
    },
  });

  return artefact;
}
