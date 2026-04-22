import { PhaseConfig } from "@/lib/ai/agent";
import { getPhase0Config } from "@/lib/ai/phases/phase0-research";
import { getPhase1Config } from "@/lib/ai/phases/phase1-analysis";
import { getPhase1AEstimateConfig } from "@/lib/ai/phases/phase1a-estimate";
import { getPhase2Config } from "@/lib/ai/phases/phase2-responses";
import { getPhase3Config } from "@/lib/ai/phases/phase3-review";
import { getPhase4Config } from "@/lib/ai/phases/phase4-gaps";
import { getPhase5Config } from "@/lib/ai/phases/phase5-capture";

export interface GetPhaseConfigExtras {
  techStackCustom?: string;
  projectDescription?: string;
  ecosystemNotes?: string;
  benchmarksMarkdown?: string;
}

export function getPhaseConfig(
  phaseNumber: string,
  techStack: string,
  engagementId: string,
  engagementType?: string,
  extras?: GetPhaseConfigExtras
): PhaseConfig {
  switch (phaseNumber) {
    case "0":
      return getPhase0Config(engagementId, techStack, engagementType);
    case "1":
      return getPhase1Config(engagementId, techStack);
    case "1A":
      return getPhase1AEstimateConfig({
        engagementId,
        techStack,
        engagementType,
        techStackCustom: extras?.techStackCustom,
        projectDescription: extras?.projectDescription,
        ecosystemNotes: extras?.ecosystemNotes,
        benchmarksMarkdown: extras?.benchmarksMarkdown,
      });
    case "2":
      return getPhase2Config(engagementId, techStack);
    case "3":
      return getPhase3Config(engagementId, techStack);
    case "3R": {
      // Combined Review & Gap Analysis: merge prompts from Phase 3 + Phase 4
      const reviewConfig = getPhase3Config(engagementId, techStack);
      const gapConfig = getPhase4Config(engagementId, techStack);
      return {
        ...reviewConfig,
        phase: 3,
        maxTurns: Math.max(reviewConfig.maxTurns, gapConfig.maxTurns),
        userPrompt: [
          reviewConfig.userPrompt,
          "\n\n---\n\nAfter completing the estimate review above, proceed to produce a full gap analysis:\n\n",
          gapConfig.userPrompt,
        ].join(""),
        tools: [...new Set([...reviewConfig.tools, ...gapConfig.tools])],
      };
    }
    case "4":
      return getPhase4Config(engagementId, techStack);
    case "5":
      return getPhase5Config(engagementId, techStack, engagementType);
    default:
      throw new Error(`Phase ${phaseNumber} is not yet implemented`);
  }
}
