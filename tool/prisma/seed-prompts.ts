/**
 * Seed script for PromptConfig records.
 * Idempotent: uses upsert with empty update object so existing records are never overwritten.
 *
 * Run with: npx tsx prisma/seed-prompts.ts
 */

import { readFile } from "fs/promises";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------
// Import prompt functions from source (sentinel values become placeholders)
// -----------------------------------------------------------------------
// Note: these imports work because seed-prompts.ts is transpiled by tsx at
// runtime. The @/ alias is not available in the seed context so we use
// relative paths.
import { getBaseSystemPrompt } from "../src/lib/ai/prompts/system-base";
import { getCarlRules } from "../src/lib/ai/prompts/carl-rules";
import {
  getPhase0Prompt,
  getPhase1Prompt,
  getPhase1AEstimatePrompt,
  getPhase1AProposalPrompt,
  getPhase2Prompt,
  getPhase3Prompt,
  getPhase4Prompt,
} from "../src/lib/ai/prompts/phase-prompts";

// phase5-capture exports getPhase5Config (not a standalone prompt getter),
// so we extract the userPrompt content by calling the inner function indirectly.
// We replicate the minimal call to get the prompt string.
function getPhase5PromptContent(): string {
  // getPhase5ProposalPrompt is not exported, but its content is embedded in
  // getPhase5Config's userPrompt field. We call getPhase5Config with sentinels
  // and read the userPrompt.
  // Importing phase5-capture requires PhaseConfig from agent — that's fine for tsx.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPhase5Config } = require("../src/lib/ai/phases/phase5-capture");
  const cfg = getPhase5Config("{{engagementId}}", "{{techStack}}", undefined);
  return cfg.userPrompt as string;
}

// -----------------------------------------------------------------------
// Filesystem-based content (templates and benchmarks)
// -----------------------------------------------------------------------
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");
const BENCHMARKS_DIR = path.resolve(__dirname, "../../benchmarks");

async function readFile_(relDir: string, filename: string): Promise<string> {
  try {
    return await readFile(path.join(relDir, filename), "utf-8");
  } catch {
    console.warn(`[seed-prompts] Warning: could not read ${path.join(relDir, filename)}`);
    return "";
  }
}

// -----------------------------------------------------------------------
// Seed entries
// -----------------------------------------------------------------------
type SeedEntry = {
  key: string;
  label: string;
  category:
    | "SYSTEM_BASE"
    | "CARL_RULES"
    | "PHASE_PROMPT"
    | "BENCHMARK"
    | "TEMPLATE";
  content: string;
};

async function buildSeedEntries(): Promise<SeedEntry[]> {
  const [
    templateResearch,
    templateAssessment,
    templateEstimate,
    templateReview,
    templateGaps,
    templateSolutionArch,
    benchmarkDrupal,
    benchmarkFrontend,
    benchmarkDiscovery,
  ] = await Promise.all([
    readFile_(TEMPLATES_DIR, "customer-research-template.md"),
    readFile_(TEMPLATES_DIR, "tor-assessment-template.md"),
    readFile_(TEMPLATES_DIR, "optimistic-estimate-template.md"),
    readFile_(TEMPLATES_DIR, "estimate-review-template.md"),
    readFile_(TEMPLATES_DIR, "gap-analysis-template.md"),
    readFile_(TEMPLATES_DIR, "solution-architecture-template.md"),
    readFile_(BENCHMARKS_DIR, "drupal-effort-ranges.md"),
    readFile_(BENCHMARKS_DIR, "frontend-effort-ranges.md"),
    readFile_(BENCHMARKS_DIR, "discovery-effort-ranges.md"),
  ]);

  // For functions that accept parameters, call with sentinel values so the
  // returned string naturally contains the {{placeholder}} tokens.
  const systemBaseContent = getBaseSystemPrompt("{{techStack}}");
  const carlRulesContent = getCarlRules();
  const phase0Content = getPhase0Prompt(undefined);
  const phase1Content = getPhase1Prompt();
  const phase1aEstimateContent = getPhase1AEstimatePrompt("{{techStack}}", "{{engagementType}}");
  const phase1aProposalContent = getPhase1AProposalPrompt("{{engagementType}}");
  const phase2Content = getPhase2Prompt();
  const phase3Content = getPhase3Prompt();
  const phase4Content = getPhase4Prompt();
  const phase5Content = getPhase5PromptContent();

  return [
    {
      key: "system-base",
      label: "Base System Prompt",
      category: "SYSTEM_BASE",
      content: systemBaseContent,
    },
    {
      key: "carl-rules",
      label: "CARL Estimation Rules",
      category: "CARL_RULES",
      content: carlRulesContent,
    },
    {
      key: "phase-0",
      label: "Phase 0: Research",
      category: "PHASE_PROMPT",
      content: phase0Content,
    },
    {
      key: "phase-1",
      label: "Phase 1: TOR Assessment",
      category: "PHASE_PROMPT",
      content: phase1Content,
    },
    {
      key: "phase-1a-estimate",
      label: "Phase 1A: Optimistic Estimate",
      category: "PHASE_PROMPT",
      content: phase1aEstimateContent,
    },
    {
      key: "phase-1a-proposal",
      label: "Phase 1A: Proposal",
      category: "PHASE_PROMPT",
      content: phase1aProposalContent,
    },
    {
      key: "phase-2",
      label: "Phase 2: Response Integration",
      category: "PHASE_PROMPT",
      content: phase2Content,
    },
    {
      key: "phase-3",
      label: "Phase 3: Estimate Review",
      category: "PHASE_PROMPT",
      content: phase3Content,
    },
    {
      key: "phase-4",
      label: "Phase 4: Gap Analysis",
      category: "PHASE_PROMPT",
      content: phase4Content,
    },
    {
      key: "phase-5",
      label: "Phase 5: Technical Proposal",
      category: "PHASE_PROMPT",
      content: phase5Content,
    },
    {
      key: "benchmark-drupal",
      label: "Drupal Effort Ranges",
      category: "BENCHMARK",
      content: benchmarkDrupal,
    },
    {
      key: "benchmark-frontend",
      label: "Frontend Effort Ranges",
      category: "BENCHMARK",
      content: benchmarkFrontend,
    },
    {
      key: "benchmark-discovery",
      label: "Discovery Effort Ranges",
      category: "BENCHMARK",
      content: benchmarkDiscovery,
    },
    {
      key: "template-research",
      label: "Customer Research Template",
      category: "TEMPLATE",
      content: templateResearch,
    },
    {
      key: "template-assessment",
      label: "TOR Assessment Template",
      category: "TEMPLATE",
      content: templateAssessment,
    },
    {
      key: "template-estimate",
      label: "Optimistic Estimate Template",
      category: "TEMPLATE",
      content: templateEstimate,
    },
    {
      key: "template-review",
      label: "Estimate Review Template",
      category: "TEMPLATE",
      content: templateReview,
    },
    {
      key: "template-gaps",
      label: "Gap Analysis Template",
      category: "TEMPLATE",
      content: templateGaps,
    },
    {
      key: "template-solution-arch",
      label: "Solution Architecture Template",
      category: "TEMPLATE",
      content: templateSolutionArch,
    },
  ];
}

async function main() {
  console.log("[seed-prompts] Building seed entries...");
  const entries = await buildSeedEntries();

  let seeded = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.content) {
      console.warn(`[seed-prompts] Skipping "${entry.key}" — content is empty`);
      skipped++;
      continue;
    }

    await prisma.promptConfig.upsert({
      where: { key: entry.key },
      // Empty update: existing records are not overwritten (idempotent)
      update: {},
      create: {
        key: entry.key,
        label: entry.label,
        category: entry.category,
        content: entry.content,
        isDefault: true,
      },
    });

    console.log(`[seed-prompts] Upserted: ${entry.key}`);
    seeded++;
  }

  console.log(
    `[seed-prompts] Done. ${seeded} records seeded, ${skipped} skipped.`
  );
}

main()
  .catch((err) => {
    console.error("[seed-prompts] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
