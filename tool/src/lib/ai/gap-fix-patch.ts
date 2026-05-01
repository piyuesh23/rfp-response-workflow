/**
 * One-shot gap-fix patch generator + applier.
 *
 * Replaces the Claude Code SDK agent loop (55KB rewrites per turn) with a
 * single Anthropic Messages API call that returns a small structured JSON
 * patch. The server applies the patch deterministically, so we never pay
 * the cost of re-serialising the whole estimate file on every edit.
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import type { EstimateLineItem } from "./sidecar-extractors";
import { extractEstimateSidecar } from "./sidecar-extractors";
import {
  renderLineItemRow,
  renderRiskRow,
  appendRowToTableBelowHeading,
  replaceEstimateSidecar,
  computeHighHrs,
  type RiskRegisterRow,
} from "./estimate-markdown";

const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 4000;

// -------------------- Patch schema --------------------

export interface LinkClausesEntry {
  itemTask: string;
  itemTab: "BACKEND" | "FRONTEND" | "FIXED_COST" | "AI";
  addClauseRefs: string[];
}

export interface NewLineItemEntry {
  tab: "BACKEND" | "FRONTEND" | "FIXED_COST" | "AI";
  task: string;
  description: string;
  hours: number;
  conf: number;
  benchmarkRef?: string | null;
  torClauseRefs: string[];
  assumptions: string;
  proposedSolution: string;
  referenceLinks?: string;
}

export interface OrphanFixEntry {
  itemTask: string;
  itemTab: "BACKEND" | "FRONTEND" | "FIXED_COST" | "AI";
  addClauseRefs?: string[];
  orphanJustification?: string;
}

export interface ConfCorrectionEntry {
  itemTask: string;
  itemTab: "BACKEND" | "FRONTEND" | "FIXED_COST" | "AI";
}

export interface RiskEntryPatch {
  task: string;
  tab: string;
  conf: number;
  risk: string;
  openQuestion: string;
  action: string;
  hoursAtRisk: number;
}

export interface GapFixPatch {
  linkClauses: LinkClausesEntry[];
  newLineItems: NewLineItemEntry[];
  orphanFixes: OrphanFixEntry[];
  confCorrections: ConfCorrectionEntry[];
  riskEntries: RiskEntryPatch[];
}

// -------------------- Generator (one Anthropic call) --------------------

export interface GeneratePatchInput {
  sidecar: EstimateLineItem[];
  gaps: Array<{ clauseRef: string; title: string; domain?: string }>;
  orphans: Array<{ tab: string; task: string }>;
  confViolations: Array<{ tab: string; task: string; field: string; expected: number; actual: number }>;
  missingRiskItems: Array<{ task: string; conf: number }>;
  techStack: string;
  techStackCustom?: string;
  engagementType?: string;
  validClauseRefs: string[];
}

export async function generateGapFixPatch(input: GeneratePatchInput): Promise<GapFixPatch> {
  const anthropic = new Anthropic();

  const platformLabel =
    input.techStackCustom?.split(/[.,;\n]/)[0].trim() || input.techStack;

  const systemPrompt = `You are a senior ${platformLabel} solution architect. Your job is to produce a SMALL JSON patch that addresses specific gaps in an existing presales estimate.

You must output ONLY valid JSON matching the schema provided. No prose, no markdown fences, no commentary — just the JSON object.

Rules:
- Prefer linking existing line items (linkClauses) over adding new ones (newLineItems). Only add a new line item when NO existing item's scope plausibly covers the gap.
- Every clauseRef you add MUST appear in the validClauseRefs list (the caller validates and rejects unknown refs).
- For new line items: tab ∈ BACKEND|FRONTEND|FIXED_COST|AI. Conf 1-6, default 4. Hours > 0. Assumptions must cite "TOR §<clauseRef>" and include "Impact if wrong: ...".
- For risk entries: one per missingRiskItem, describe a real dependency/risk + an open question for PM/Client + a recommended mitigation.
- For confCorrections: just list the items; the server recomputes the math.`;

  const userPrompt = `## Engagement
- Platform: ${platformLabel}
- Engagement type: ${input.engagementType ?? "NEW_BUILD"}

## Current line items (sidecar JSON, read-only)
${JSON.stringify(input.sidecar.map((li, i) => ({ idx: i, tab: li.tab, task: li.task, torClauseRefs: li.torClauseRefs })), null, 2)}

## Valid TOR clauseRefs
${input.validClauseRefs.join(", ")}

## Gaps to resolve (TOR requirements with no linked line item)
${input.gaps.map((g) => `- ${g.clauseRef}: ${g.title}${g.domain ? ` [${g.domain}]` : ""}`).join("\n") || "(none)"}

## Orphan line items (no TOR refs and no justification)
${input.orphans.map((o) => `- ${o.tab} / ${o.task}`).join("\n") || "(none)"}

## Conf formula violations (server will recompute correct values)
${input.confViolations.map((v) => `- ${v.tab} / ${v.task} (field: ${v.field}, expected: ${v.expected}, actual: ${v.actual})`).join("\n") || "(none)"}

## Missing risk register entries (Conf ≤4 items without risk entries)
${input.missingRiskItems.map((r) => `- ${r.task} (Conf ${r.conf})`).join("\n") || "(none)"}

---

Output a JSON object matching this TypeScript schema EXACTLY:

\`\`\`ts
{
  linkClauses: Array<{ itemTask: string; itemTab: "BACKEND"|"FRONTEND"|"FIXED_COST"|"AI"; addClauseRefs: string[] }>,
  newLineItems: Array<{
    tab: "BACKEND"|"FRONTEND"|"FIXED_COST"|"AI",
    task: string, description: string,
    hours: number, conf: number,
    benchmarkRef: string | null,
    torClauseRefs: string[],
    assumptions: string, proposedSolution: string,
    referenceLinks: string
  }>,
  orphanFixes: Array<{ itemTask: string; itemTab: "BACKEND"|"FRONTEND"|"FIXED_COST"|"AI"; addClauseRefs?: string[]; orphanJustification?: string }>,
  confCorrections: Array<{ itemTask: string; itemTab: "BACKEND"|"FRONTEND"|"FIXED_COST"|"AI" }>,
  riskEntries: Array<{ task: string; tab: string; conf: number; risk: string; openQuestion: string; action: string; hoursAtRisk: number }>
}
\`\`\`

Omit arrays if there's nothing to do for that category (use []). Emit ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const trimmed = text.trim().replace(/^```json\s*|```$/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Gap-fix patch JSON invalid: ${err instanceof Error ? err.message : String(err)}. Raw: ${trimmed.slice(0, 200)}`);
  }

  const patch = parsed as Partial<GapFixPatch>;
  return {
    linkClauses: patch.linkClauses ?? [],
    newLineItems: patch.newLineItems ?? [],
    orphanFixes: patch.orphanFixes ?? [],
    confCorrections: patch.confCorrections ?? [],
    riskEntries: patch.riskEntries ?? [],
  };
}

// -------------------- Applier (pure, no AI) --------------------

export interface ApplyPatchResult {
  updatedLineItems: EstimateLineItem[];
  markdown: string;
  warnings: string[];
  stats: {
    clauseLinksAdded: number;
    newItemsAdded: number;
    orphanFixesApplied: number;
    confCorrected: number;
    riskRowsAppended: number;
  };
}

export async function applyGapFixPatch(
  estimatePath: string,
  patch: GapFixPatch,
  validClauseRefs: Set<string>
): Promise<ApplyPatchResult> {
  const original = await fs.readFile(estimatePath, "utf-8");
  const sidecar = extractEstimateSidecar(original);
  if (!sidecar) throw new Error("Cannot apply patch: no ESTIMATE-LINEITEMS-JSON sidecar in file");

  const warnings: string[] = [];
  const stats = {
    clauseLinksAdded: 0,
    newItemsAdded: 0,
    orphanFixesApplied: 0,
    confCorrected: 0,
    riskRowsAppended: 0,
  };

  const items = sidecar.lineItems.map((li) => ({ ...li, torClauseRefs: [...(li.torClauseRefs ?? [])] }));

  // Build a lookup key for existing items by {tab, task}. Case-insensitive match on task.
  const findItem = (tab: string, task: string): EstimateLineItem | undefined =>
    items.find((li) => li.tab === tab && li.task.trim().toLowerCase() === task.trim().toLowerCase());

  // --- 1. linkClauses: add clauseRefs to existing sidecar items ---
  for (const entry of patch.linkClauses) {
    const item = findItem(entry.itemTab, entry.itemTask);
    if (!item) {
      warnings.push(`linkClauses: no sidecar item matches ${entry.itemTab} / ${entry.itemTask}`);
      continue;
    }
    const refsToAdd = entry.addClauseRefs.filter((r) => validClauseRefs.has(r) && !item.torClauseRefs.includes(r));
    if (refsToAdd.length === 0 && entry.addClauseRefs.length > 0) {
      warnings.push(`linkClauses: all proposed refs for ${entry.itemTask} invalid or already present: ${entry.addClauseRefs.join(", ")}`);
      continue;
    }
    item.torClauseRefs.push(...refsToAdd);
    item.orphanJustification = null;
    stats.clauseLinksAdded += refsToAdd.length;
  }

  // --- 2. newLineItems: append new items (also append a row to markdown table) ---
  let markdown = original;
  const tabHeadings: Record<string, RegExp> = {
    BACKEND: /^##\s+Backend Tab\s*$/m,
    FRONTEND: /^##\s+Frontend Tab\s*$/m,
    FIXED_COST: /^##\s+Fixed Cost Items Tab\s*$/m,
    AI: /^##\s+AI Tab\s*$/m,
  };

  for (const n of patch.newLineItems) {
    if (!["BACKEND", "FRONTEND", "FIXED_COST", "AI"].includes(n.tab)) {
      warnings.push(`newLineItems: invalid tab "${n.tab}" for task "${n.task}"`);
      continue;
    }
    if (n.hours <= 0 || !Number.isFinite(n.hours)) {
      warnings.push(`newLineItems: invalid hours ${n.hours} for task "${n.task}"`);
      continue;
    }
    if (n.conf < 1 || n.conf > 6) {
      warnings.push(`newLineItems: invalid conf ${n.conf} for task "${n.task}"`);
      continue;
    }
    const validRefs = n.torClauseRefs.filter((r) => validClauseRefs.has(r));
    if (validRefs.length !== n.torClauseRefs.length) {
      warnings.push(`newLineItems: stripped invalid clauseRefs from "${n.task}": ${n.torClauseRefs.filter((r) => !validClauseRefs.has(r)).join(", ")}`);
    }
    const lowHrs = n.hours;
    const highHrs = computeHighHrs(n.hours, n.conf);

    const newItem: EstimateLineItem = {
      tab: n.tab,
      task: n.task,
      description: n.description,
      hours: n.hours,
      conf: n.conf,
      lowHrs,
      highHrs,
      benchmarkRef: n.benchmarkRef ?? null,
      integrationTier: null,
      torClauseRefs: validRefs,
      orphanJustification: validRefs.length === 0 ? "Cross-cutting task added to cover gap" : null,
    };
    items.push(newItem);

    // Append markdown table row under the matching tab
    const heading = tabHeadings[n.tab];
    const row = renderLineItemRow(newItem, {
      assumptions: n.assumptions,
      proposedSolution: n.proposedSolution,
      referenceLinks: n.referenceLinks ?? "",
    });
    const next = appendRowToTableBelowHeading(markdown, heading, row);
    if (next === markdown) {
      warnings.push(`newLineItems: heading not found for tab ${n.tab} — markdown row NOT appended for "${n.task}" (sidecar still updated)`);
    } else {
      markdown = next;
    }
    stats.newItemsAdded += 1;
  }

  // --- 3. orphanFixes ---
  for (const o of patch.orphanFixes) {
    const item = findItem(o.itemTab, o.itemTask);
    if (!item) {
      warnings.push(`orphanFixes: no sidecar item matches ${o.itemTab} / ${o.itemTask}`);
      continue;
    }
    if (o.addClauseRefs && o.addClauseRefs.length > 0) {
      const refs = o.addClauseRefs.filter((r) => validClauseRefs.has(r) && !item.torClauseRefs.includes(r));
      item.torClauseRefs.push(...refs);
      item.orphanJustification = null;
      stats.orphanFixesApplied += 1;
    } else if (o.orphanJustification && o.orphanJustification.trim().length > 0) {
      item.orphanJustification = o.orphanJustification.trim();
      stats.orphanFixesApplied += 1;
    } else {
      warnings.push(`orphanFixes: ${o.itemTask} has neither addClauseRefs nor orphanJustification — skipped`);
    }
  }

  // --- 4. confCorrections: recompute lowHrs/highHrs for the named items ---
  for (const c of patch.confCorrections) {
    const item = findItem(c.itemTab, c.itemTask);
    if (!item) {
      warnings.push(`confCorrections: no sidecar item matches ${c.itemTab} / ${c.itemTask}`);
      continue;
    }
    item.lowHrs = item.hours;
    item.highHrs = computeHighHrs(item.hours, item.conf);
    stats.confCorrected += 1;
  }

  // --- 5. riskEntries: append rows to the Risk Register markdown table ---
  const riskHeading = /^##\s+Risk Register\s*$/m;
  for (const r of patch.riskEntries) {
    const row: RiskRegisterRow = {
      task: r.task,
      tab: r.tab,
      conf: r.conf,
      risk: r.risk,
      openQuestion: r.openQuestion,
      action: r.action,
      hoursAtRisk: r.hoursAtRisk,
    };
    const rowText = renderRiskRow(row);
    const next = appendRowToTableBelowHeading(markdown, riskHeading, rowText);
    if (next === markdown) {
      warnings.push(`riskEntries: Risk Register heading not found — row NOT appended for "${r.task}"`);
    } else {
      markdown = next;
      stats.riskRowsAppended += 1;
    }
  }

  // Update the sidecar block with the patched items
  markdown = replaceEstimateSidecar(markdown, items);

  await fs.writeFile(estimatePath, markdown, "utf-8");

  return { updatedLineItems: items, markdown, warnings, stats };
}
