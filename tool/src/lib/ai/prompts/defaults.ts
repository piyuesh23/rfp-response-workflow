import {
  getPhase0Prompt,
  getPhase1Prompt,
  getPhase1AEstimatePrompt,
  getPhase2Prompt,
  getPhase3Prompt,
  getPhase4Prompt,
} from "./phase-prompts";

export const PHASE_LABELS: Record<string, string> = {
  "0": "Customer Research",
  "1": "TOR Analysis",
  "1A": "Optimistic Estimation",
  "2": "Response Integration",
  "3": "Estimate Review",
  "4": "Gap Analysis",
  "5": "Knowledge Capture",
};

export function getDefaultPrompt(phaseNumber: string): string {
  switch (phaseNumber) {
    case "0":
      return getPhase0Prompt();
    case "1":
      return getPhase1Prompt();
    case "1A":
      return getPhase1AEstimatePrompt();
    case "2":
      return getPhase2Prompt();
    case "3":
      return getPhase3Prompt();
    case "4":
      return getPhase4Prompt();
    default:
      return "";
  }
}
