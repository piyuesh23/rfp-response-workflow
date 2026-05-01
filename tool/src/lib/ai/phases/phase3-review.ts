import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import { getPhase3Prompt } from "@/lib/ai/prompts/phase-prompts";

export function getPhase3Config(
  engagementId: string,
  techStack: string,
  engagementType?: string
): PhaseConfig {
  return {
    engagementId,
    phase: 3,
    techStack,
    tools: ["Read", "Glob", "Grep", "Write"],
    maxTurns: 40,
    systemPrompt: [getBaseSystemPrompt(techStack), getCarlRules()].join(
      "\n\n---\n\n"
    ),
    userPrompt: getPhase3Prompt(techStack, engagementType),
  };
}

// Phase 3R no longer uses an agent loop — it runs runPhase3RCritique
// (a single aiJsonCall) directly in phase-runner.ts. This file no longer
// exports getPhase3RConfig.
