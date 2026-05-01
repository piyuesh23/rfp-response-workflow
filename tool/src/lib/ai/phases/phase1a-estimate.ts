import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import { getPhase1AEstimatePrompt } from "@/lib/ai/prompts/phase-prompts";

export interface Phase1AEstimateConfigArgs {
  engagementId: string;
  techStack: string;
  engagementType?: string;
  techStackCustom?: string;
  projectDescription?: string;
  ecosystemNotes?: string;
  benchmarksMarkdown?: string;
}

// Back-compat: callers may still pass (engagementId, techStack, engagementType)
export function getPhase1AEstimateConfig(args: Phase1AEstimateConfigArgs): PhaseConfig;
export function getPhase1AEstimateConfig(
  engagementId: string,
  techStack: string,
  engagementType?: string
): PhaseConfig;
export function getPhase1AEstimateConfig(
  arg1: string | Phase1AEstimateConfigArgs,
  arg2?: string,
  arg3?: string
): PhaseConfig {
  const args: Phase1AEstimateConfigArgs =
    typeof arg1 === "string"
      ? { engagementId: arg1, techStack: arg2 ?? "", engagementType: arg3 }
      : arg1;
  const {
    engagementId,
    techStack,
    engagementType,
    techStackCustom,
    projectDescription,
    ecosystemNotes,
    benchmarksMarkdown,
  } = args;

  return {
    engagementId,
    phase: 1,
    techStack,
    tools: ["Read", "Write", "Glob", "Grep"],
    maxTurns: 30,
    systemPrompt: [getBaseSystemPrompt(techStack), getCarlRules()].join(
      "\n\n---\n\n"
    ),
    userPrompt: getPhase1AEstimatePrompt({
      techStack,
      engagementType,
      techStackCustom,
      projectDescription,
      ecosystemNotes,
      benchmarksMarkdown,
    }),
  };
}
