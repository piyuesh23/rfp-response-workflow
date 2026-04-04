import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import { getPhase0Prompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase0Config(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 0,
    techStack,
    tools: ["Read", "Write", "Glob", "WebSearch", "WebFetch"],
    maxTurns: 80,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      getCarlRules(),
      "You are conducting pre-engagement research.",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase0Prompt(),
  };
}
