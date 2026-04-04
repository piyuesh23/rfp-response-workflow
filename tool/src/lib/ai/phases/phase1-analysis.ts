import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import { getPhase1Prompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase1Config(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 1,
    techStack,
    tools: ["Read", "Glob", "Grep", "Write"],
    maxTurns: 60,
    systemPrompt: [getBaseSystemPrompt(techStack), getCarlRules()].join(
      "\n\n---\n\n"
    ),
    userPrompt: getPhase1Prompt(),
  };
}
