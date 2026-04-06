import { prisma } from "@/lib/db";
import { PhaseConfig } from "@/lib/ai/agent";

export async function applyPromptOverrides(
  config: PhaseConfig
): Promise<PhaseConfig> {
  const overrides = await prisma.promptOverride.findMany({
    where: { phaseNumber: String(config.phase), isActive: true },
    orderBy: { version: "desc" },
    take: 2, // at most one SYSTEM and one USER
  });

  let result = { ...config };
  for (const override of overrides) {
    if (override.promptType === "USER") result.userPrompt = override.content;
    if (override.promptType === "SYSTEM") result.systemPrompt = override.content;
  }
  return result;
}
