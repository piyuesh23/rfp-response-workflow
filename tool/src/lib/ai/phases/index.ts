import { PhaseConfig } from "@/lib/ai/agent";
import { getPhase0Config } from "@/lib/ai/phases/phase0-research";
import { getPhase1Config } from "@/lib/ai/phases/phase1-analysis";
import { getPhase1AEstimateConfig } from "@/lib/ai/phases/phase1a-estimate";
import { getPhase1AProposalConfig } from "@/lib/ai/phases/phase1a-proposal";

export function getPhaseConfig(
  phaseNumber: string,
  techStack: string,
  engagementId: string
): PhaseConfig {
  switch (phaseNumber) {
    case "0":
      return getPhase0Config(engagementId, techStack);
    case "1":
      return getPhase1Config(engagementId, techStack);
    case "1A":
      return getPhase1AEstimateConfig(engagementId, techStack);
    case "1A-proposal":
      return getPhase1AProposalConfig(engagementId, techStack);
    case "2":
    case "3":
    case "4":
    case "5":
      throw new Error(`Phase ${phaseNumber} is not yet implemented`);
    default:
      throw new Error(`Phase ${phaseNumber} is not yet implemented`);
  }
}
