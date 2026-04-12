import { prisma } from "@/lib/db";
import { PromptCategory } from "@/generated/prisma/client";

// In-memory cache with 60s TTL
const cache = new Map<string, { content: string; expiry: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Load a single prompt config by key from the database.
 * Returns null if no record exists for that key.
 * Results are cached in-memory for 60 seconds.
 */
export async function loadPromptConfig(key: string): Promise<string | null> {
  // Check cache
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.content;

  // Query DB
  const config = await prisma.promptConfig.findUnique({ where: { key } });
  if (config) {
    cache.set(key, {
      content: config.content,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    return config.content;
  }
  return null;
}

/**
 * Invalidate the in-memory cache.
 * Pass a key to invalidate a single entry, or no argument to clear all.
 */
export function invalidateCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Interpolate {{placeholder}} tokens in a template string with provided values.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Load all BENCHMARK category configs and concatenate them into a single string.
 * Returns an empty string if no benchmark configs exist in the database.
 */
export async function loadAllBenchmarks(): Promise<string> {
  const benchmarks = await prisma.promptConfig.findMany({
    where: { category: PromptCategory.BENCHMARK },
    orderBy: { key: "asc" },
  });

  if (benchmarks.length === 0) return "";

  const sections = benchmarks.map(
    (b) =>
      `### ${b.label}\n\n${b.content}`
  );

  return sections.join("\n\n---\n\n");
}

/**
 * Map a phase number string to the corresponding template key(s) and load
 * their content from the database.
 *
 * Phase 1A has two templates (solution-arch + estimate); they are concatenated.
 * Returns an empty string if no template configs are found for the phase.
 */
export async function loadPhaseTemplate(phaseNumber: string): Promise<string> {
  const templateKeyMap: Record<string, string[]> = {
    "0": ["template-research"],
    "1": ["template-assessment"],
    "1A": ["template-solution-arch", "template-estimate"],
    "3": ["template-review"],
    "3R": ["template-gaps"],
    "4": ["template-gaps"],
  };

  const keys = templateKeyMap[phaseNumber];
  if (!keys || keys.length === 0) return "";

  const sections: string[] = [];

  for (const key of keys) {
    const content = await loadPromptConfig(key);
    if (content) {
      // Derive a human-readable label from the key
      const label = key.replace("template-", "").replace(/-/g, " ");
      sections.push(
        `## Output Template: ${label}\n\nFollow this structure:\n\n${content}`
      );
    }
  }

  if (sections.length === 0) return "";
  return `\n\n---\n\n${sections.join("\n\n---\n\n")}`;
}
