import { z } from "zod";

/**
 * Phase 1 TOR requirements sidecar
 * Embedded at the end of claude-artefacts/tor-assessment.md as:
 *
 *   <!-- PHASE1-REQUIREMENTS-JSON
 *   { "requirements": [ { "clauseRef", "title", "description", "domain", "clarityRating" }, ... ] }
 *   -->
 */

const DOMAIN_VALUES = [
  "content_arch",
  "integration",
  "migration",
  "frontend",
  "devops",
  "seo",
  "a11y",
  "perf",
  "security",
  "other",
] as const;

const CLARITY_VALUES = [
  "CLEAR",
  "NEEDS_CLARIFICATION",
  "AMBIGUOUS",
  "MISSING_DETAIL",
] as const;

const TAB_VALUES = ["BACKEND", "FRONTEND", "FIXED_COST", "DESIGN", "AI"] as const;

const INTEGRATION_TIER_VALUES = ["T1", "T2", "T3"] as const;

const Phase1RequirementSchema = z.object({
  clauseRef: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  domain: z.enum(DOMAIN_VALUES).catch("other"),
  clarityRating: z.enum(CLARITY_VALUES).catch("NEEDS_CLARIFICATION"),
});

const Phase1SidecarSchema = z.object({
  requirements: z.array(Phase1RequirementSchema),
});

export type Phase1Requirement = z.infer<typeof Phase1RequirementSchema>;
export type Phase1Sidecar = z.infer<typeof Phase1SidecarSchema>;

const EstimateLineItemSchema = z.object({
  tab: z.enum(TAB_VALUES),
  task: z.string().min(1),
  description: z.string().default(""),
  hours: z.number().nonnegative(),
  conf: z.number().int().min(1).max(6),
  lowHrs: z.number().nonnegative(),
  highHrs: z.number().nonnegative(),
  benchmarkRef: z.string().nullable().optional(),
  integrationTier: z
    .enum(INTEGRATION_TIER_VALUES)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  torClauseRefs: z.array(z.string()).default([]),
  orphanJustification: z.string().nullable().optional(),
});

const EstimateSidecarSchema = z.object({
  lineItems: z.array(EstimateLineItemSchema),
});

export type EstimateLineItem = z.infer<typeof EstimateLineItemSchema>;
export type EstimateSidecar = z.infer<typeof EstimateSidecarSchema>;

const PHASE1_SIDECAR_RE = /<!--\s*PHASE1-REQUIREMENTS-JSON\s*([\s\S]*?)-->/;
const ESTIMATE_SIDECAR_RE = /<!--\s*ESTIMATE-LINEITEMS-JSON\s*([\s\S]*?)-->/;

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    // Tolerate trailing commas / fenced blocks that may sneak in
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

/**
 * Extract the Phase 1 TOR requirements sidecar from markdown.
 * Returns null if the sidecar is missing or malformed (non-crashing).
 */
export function extractPhase1Sidecar(markdown: string): Phase1Sidecar | null {
  if (!markdown) return null;
  const match = markdown.match(PHASE1_SIDECAR_RE);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = safeJsonParse(match[1].trim());
  if (!parsed) {
    console.warn("[sidecar-extractors] PHASE1-REQUIREMENTS-JSON: JSON parse failed");
    return null;
  }
  const result = Phase1SidecarSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[sidecar-extractors] PHASE1-REQUIREMENTS-JSON: schema validation failed — ${result.error.message}`
    );
    return null;
  }
  return result.data;
}

/**
 * Extract the Phase 1A / Phase 3 estimate line items sidecar from markdown.
 * Returns null if the sidecar is missing or malformed (non-crashing).
 */
export function extractEstimateSidecar(markdown: string): EstimateSidecar | null {
  if (!markdown) return null;
  const match = markdown.match(ESTIMATE_SIDECAR_RE);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = safeJsonParse(match[1].trim());
  if (!parsed) {
    console.warn("[sidecar-extractors] ESTIMATE-LINEITEMS-JSON: JSON parse failed");
    return null;
  }
  const result = EstimateSidecarSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[sidecar-extractors] ESTIMATE-LINEITEMS-JSON: schema validation failed — ${result.error.message}`
    );
    return null;
  }
  return result.data;
}

/**
 * Normalize a TOR clause reference for fuzzy matching.
 * Matches the DB field `TorRequirement.normalizedClauseRef`.
 */
export function normalizeClauseRef(clauseRef: string): string {
  return clauseRef.toLowerCase().replace(/\s+/g, "");
}
