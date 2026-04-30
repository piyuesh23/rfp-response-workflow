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

// Map of known AI-generated variants → canonical enum value.
// The AI sometimes writes "Fixed Cost Items", "Backend", "front-end", etc.
const TAB_ALIAS: Record<string, (typeof TAB_VALUES)[number]> = {
  backend: "BACKEND",
  "back end": "BACKEND",
  back_end: "BACKEND",
  frontend: "FRONTEND",
  "front end": "FRONTEND",
  front_end: "FRONTEND",
  "fixed cost": "FIXED_COST",
  "fixed cost items": "FIXED_COST",
  fixed_cost: "FIXED_COST",
  fixed_cost_items: "FIXED_COST",
  fixedcost: "FIXED_COST",
  fixedcostitems: "FIXED_COST",
  design: "DESIGN",
  "design system": "DESIGN",
  design_system: "DESIGN",
  ai: "AI",
};

function normalizeTabValue(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const key = v.toLowerCase().trim().replace(/\s+/g, " ");
  if (key in TAB_ALIAS) return TAB_ALIAS[key];
  // Also try stripping all spaces/underscores as a last pass
  const collapsed = key.replace(/[\s_]+/g, "");
  if (collapsed in TAB_ALIAS) return TAB_ALIAS[collapsed];
  // Try uppercasing with underscores in case the AI used a close match
  return v.toUpperCase().replace(/\s+/g, "_");
}

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
  tab: z.preprocess(normalizeTabValue, z.enum(TAB_VALUES)),
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
 * Resilient: if strict parse fails, retries item-by-item to salvage valid entries.
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
    // Log the validation errors but attempt item-by-item salvage before giving up.
    console.warn(
      `[sidecar-extractors] ESTIMATE-LINEITEMS-JSON: schema validation failed — ${JSON.stringify(result.error.issues)}`
    );
    // Attempt partial parse: validate each line item individually and skip bad ones.
    const rawItems = (parsed as Record<string, unknown>)?.lineItems;
    if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
    const valid: EstimateLineItem[] = [];
    let skipped = 0;
    for (const item of rawItems) {
      const itemResult = EstimateLineItemSchema.safeParse(item);
      if (itemResult.success) {
        valid.push(itemResult.data);
      } else {
        skipped++;
      }
    }
    if (valid.length === 0) return null;
    console.warn(
      `[sidecar-extractors] ESTIMATE-LINEITEMS-JSON: salvaged ${valid.length} item(s), skipped ${skipped} invalid.`
    );
    return { lineItems: valid };
  }
  return result.data;
}

/**
 * Phase 2 TOR requirements update sidecar
 * Embedded at the end of claude-artefacts/response-analysis.md as:
 *
 *   <!-- PHASE2-REQUIREMENTS-UPDATE-JSON
 *   { "updates": [ { "clauseRef", "clarityRating", "responseNotes" }, ... ] }
 *   -->
 */

const Phase2RequirementUpdateSchema = z.object({
  clauseRef: z.string().min(1),
  clarityRating: z.enum(CLARITY_VALUES).catch("NEEDS_CLARIFICATION"),
  responseNotes: z.string().default(""),
});

const Phase2SidecarSchema = z.object({
  updates: z.array(Phase2RequirementUpdateSchema),
});

export type Phase2RequirementUpdate = z.infer<typeof Phase2RequirementUpdateSchema>;
export type Phase2Sidecar = z.infer<typeof Phase2SidecarSchema>;

const PHASE2_SIDECAR_RE = /<!--\s*PHASE2-REQUIREMENTS-UPDATE-JSON\s*([\s\S]*?)-->/;

/**
 * Extract the Phase 2 requirements update sidecar from markdown.
 * Returns null if the sidecar is missing or malformed (non-crashing).
 */
export function extractPhase2Sidecar(markdown: string): Phase2Sidecar | null {
  if (!markdown) return null;
  const match = markdown.match(PHASE2_SIDECAR_RE);
  if (!match || !match[1]) return null;
  const parsed = safeJsonParse(match[1].trim());
  if (!parsed) {
    console.warn("[sidecar-extractors] PHASE2-REQUIREMENTS-UPDATE-JSON: JSON parse failed");
    return null;
  }
  const result = Phase2SidecarSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[sidecar-extractors] PHASE2-REQUIREMENTS-UPDATE-JSON: schema validation failed — ${result.error.message}`
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
