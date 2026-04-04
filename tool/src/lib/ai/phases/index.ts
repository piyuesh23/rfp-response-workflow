import { PhaseConfig } from "@/lib/ai/agent";
import { getPhase1Config } from "@/lib/ai/phases/phase1-analysis";

export function getPhaseConfig(
  phaseNumber: string,
  techStack: string,
  engagementId: string
): PhaseConfig {
  switch (phaseNumber) {
    case "1":
      return getPhase1Config(engagementId, techStack);
    default:
      throw new Error(
        `Phase ${phaseNumber} is not yet implemented`
      );
  }
}
