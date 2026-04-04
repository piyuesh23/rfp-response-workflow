import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getPhase1AProposalPrompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase1AProposalConfig(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 1,
    techStack,
    tools: ["Read", "Write"],
    maxTurns: 40,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      "You are generating a client-facing technical proposal.",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase1AProposalPrompt(),
  };
}
