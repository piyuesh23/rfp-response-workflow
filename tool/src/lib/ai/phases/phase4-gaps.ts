import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import { getPhase4Prompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase4Config(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 4,
    techStack,
    tools: ["Read", "Write", "Glob", "Grep"],
    maxTurns: 50,
    systemPrompt: [getBaseSystemPrompt(techStack), getCarlRules()].join(
      "\n\n---\n\n"
    ),
    userPrompt: getPhase4Prompt(),
  };
}
