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
      return getPhase3Config(engagementId, techStack, engagementType);
    case "3R":
      // Phase 3R runs as a structured aiJsonCall critique (runPhase3RCritique),
      // NOT an agent loop. phase-runner.ts branches before calling runPhase for
      // this phase number. getPhase3Config is returned here only as a fallback
      // to satisfy the return-type requirement; it is never actually used for 3R.
      return getPhase3Config(engagementId, techStack, engagementType);
    case "4":
      return getPhase4Config(engagementId, techStack);
    case "5":
      return getPhase5Config(engagementId, techStack, engagementType);
    default:
      throw new Error(`Phase ${phaseNumber} is not yet implemented`);
  }
}
