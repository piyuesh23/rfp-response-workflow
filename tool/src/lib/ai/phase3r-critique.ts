/**
 * Phase 3R structured critique — replaces the 20-turn agent-loop markdown
 * reviewer with a single Sonnet aiJsonCall that returns machine-readable
 * findings. Semantic issues (contradictions, scope drift) feed directly into
 * generateGapFixPatch rather than producing unstructured prose.
 *
 * Deterministic validators handle formula/coverage/conf-formula; this module
 * only fires when those pass (or WARN) and adds semantic signal:
 *   - clauseRef present but line item scope contradicts TOR text
 *   - line items with scope creep beyond what TOR authorised
 *   - semantic gaps where coverage is technically satisfied but semantically wrong
 */

import { z } from "zod";
import { aiJsonCall } from "./ai-with-retry";
import { getCarlRules } from "./prompts/carl-rules";

// -------------------- Schema --------------------

const SemanticGapSchema = z.object({
  clauseRef: z.string(),
  issue: z.string(),
  suggestedAction: z.enum(["link-existing", "add-new-line-item", "split-existing"]),
});

const ContradictionSchema = z.object({
  itemTask: z.string(),
  conflict: z.string(),
  torRef: z.string(),
});

const ScopeDriftSchema = z.object({
  itemTask: z.string(),
  reason: z.string(),
});

const Phase3RFindingsSchema = z.object({
  semanticGaps: z.array(SemanticGapSchema).default([]),
  contradictions: z.array(ContradictionSchema).default([]),
  scopeDrift: z.array(ScopeDriftSchema).default([]),
  severity: z.enum(["PASS", "WARN", "FAIL"]),
  summary: z.string().default(""),
});

export type Phase3RFindings = z.infer<typeof Phase3RFindingsSchema>;

// -------------------- Critique prompt --------------------

const SYSTEM_PROMPT = `${getCarlRules()}

---

You are a senior solution architect conducting a structured estimate critique. Your output is machine-readable JSON — no prose, no markdown fences, strictly the JSON object matching the schema.

Your role is semantic validation ONLY. Deterministic checks (Conf-buffer formula, Risk Register coverage, assumption sourcing) have already run. Focus on:
1. TOR requirements that are technically "covered" by a line item but where the line item's scope is wrong, too narrow, or misaligned.
2. Line items whose scope creeps beyond what the TOR authorised.
3. Contradictions between assumptions and TOR/Q&A statements.

Severity rules:
- FAIL: any semanticGap with suggestedAction=add-new-line-item, OR any contradiction
- WARN: semanticGaps with link-existing/split-existing, or scopeDrift items
- PASS: no issues found

Keep findings concise. Maximum 10 items per array.`;

function buildUserPrompt(opts: {
  estimateMd: string;
  torExcerpts: string;
  responsesQna?: string;
}): string {
  const sections = [
    "## Estimate (current)",
    "```",
    opts.estimateMd.slice(0, 12000),
    "```",
    "",
    "## TOR excerpts",
    "```",
    opts.torExcerpts.slice(0, 6000),
    "```",
  ];

  if (opts.responsesQna?.trim()) {
    sections.push("", "## Customer Q&A responses", "```", opts.responsesQna.slice(0, 3000), "```");
  }

  sections.push(
    "",
    "Analyse the estimate against the TOR and Q&A. Return JSON matching the schema exactly.",
    'If nothing is wrong, return { semanticGaps: [], contradictions: [], scopeDrift: [], severity: "PASS", summary: "No issues found." }'
  );

  return sections.join("\n");
}

// -------------------- Public API --------------------

export async function runPhase3RCritique(opts: {
  engagementId: string;
  estimateMd: string;
  torExcerpts: string;
  responsesQna?: string;
}): Promise<Phase3RFindings> {
  return aiJsonCall<Phase3RFindings>({
    engagementId: opts.engagementId,
    phase: "3R",
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
    schema: Phase3RFindingsSchema,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(opts),
    maxRetries: 1,
  });
}

/** Format findings as a human-readable markdown document for gap-analysis.md */
export function formatFindingsAsMarkdown(findings: Phase3RFindings): string {
  const lines: string[] = [
    "# Phase 3R Critique — Structured Findings",
    "",
    `**Severity:** ${findings.severity}`,
    "",
    findings.summary ? `> ${findings.summary}` : "",
    "",
  ];

  if (findings.semanticGaps.length > 0) {
    lines.push("## Semantic Gaps", "");
    for (const g of findings.semanticGaps) {
      lines.push(`- **${g.clauseRef}**: ${g.issue} *(action: ${g.suggestedAction})*`);
    }
    lines.push("");
  }

  if (findings.contradictions.length > 0) {
    lines.push("## Contradictions", "");
    for (const c of findings.contradictions) {
      lines.push(`- **${c.itemTask}** (re: ${c.torRef}): ${c.conflict}`);
    }
    lines.push("");
  }

  if (findings.scopeDrift.length > 0) {
    lines.push("## Scope Drift", "");
    for (const s of findings.scopeDrift) {
      lines.push(`- **${s.itemTask}**: ${s.reason}`);
    }
    lines.push("");
  }

  lines.push("---", "", "```json", JSON.stringify(findings, null, 2), "```");

  return lines.filter((l) => l !== undefined).join("\n");
}
