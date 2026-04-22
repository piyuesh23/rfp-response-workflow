import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getMigrationAccessChecklistPrompt } from "@/lib/ai/prompts/phase-prompts";

export interface Phase1ALegacyChecklistArgs {
  engagementId: string;
  techStack: string;
  engagementType?: string;
  legacyPlatform?: string;
  legacyPlatformUrl?: string;
  techStackCustom?: string;
}

export function getPhase1ALegacyChecklistConfig(
  args: Phase1ALegacyChecklistArgs
): PhaseConfig {
  const { engagementId, techStack, engagementType, legacyPlatform, legacyPlatformUrl, techStackCustom } = args;
  return {
    engagementId,
    phase: 1,
    techStack,
    tools: ["Read", "Write", "Glob"],
    maxTurns: 25,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      "You are drafting a client-facing Legacy Platform Access Checklist. Keep content crisp, actionable, and tailored to the stated legacy platform.",
    ].join("\n\n---\n\n"),
    userPrompt: getMigrationAccessChecklistPrompt({
      engagementType,
      legacyPlatform,
      legacyPlatformUrl,
      techStackCustom,
    }),
  };
}
