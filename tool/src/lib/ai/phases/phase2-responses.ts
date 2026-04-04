import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getPhase2Prompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase2Config(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 2,
    techStack,
    tools: ["Read", "Write", "Glob", "Grep"],
    maxTurns: 40,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      "You are mapping customer Q&A responses to original TOR requirements",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase2Prompt(),
  };
}
