# Phase tier2-model-evaluation: Sonnet Model Evaluation for Per-Phase Model Routing — Research

**Researched:** 2026-05-01
**Domain:** Anthropic Claude API model lineup, capability tiers, cost-quality routing
**Confidence:** HIGH (primary data from official Anthropic docs)

---

## Summary

The presales tool currently uses two models: `claude-sonnet-4-20250514` (Sonnet 4.0, May 2025) as the default and `claude-opus-4-20250514` (Opus 4.0, May 2025) for high-complexity phases. Both of these models are **deprecated as of April 14, 2026 and will return API errors after June 15, 2026**. This is a hard deadline — migration is not optional.

The current model lineup has shifted significantly. Opus 4.7 has replaced Opus 4.0/4.5/4.6 as the flagship, and critically **Opus 4.7 does NOT support `budget_tokens` extended thinking** — it uses a new `adaptive` thinking API instead. This means the existing `buildThinkingParam()` function in `agent.ts` will break with a 400 error if pointed at Opus 4.7 without updating the thinking parameter shape. Sonnet 4.6 is the current recommended Sonnet model and supports extended thinking with `budget_tokens` up to 64k. Haiku 4.5 is the lightweight option, suitable for low-complexity structured output phases.

**Primary recommendation:** Migrate default Sonnet to `claude-sonnet-4-6`, upgrade Opus phases to `claude-opus-4-7` with the new adaptive thinking API, and route Phase 5 (knowledge capture) to `claude-haiku-4-5-20251001` to reduce cost on the lowest-complexity phase.

---

## Standard Stack

### Current vs. Recommended Model Lineup

| Model Name | Exact API ID (alias) | Exact API ID (snapshot) | Pricing (input/output per MTok) | Context Window | Max Output | Extended Thinking | Adaptive Thinking | Status |
|---|---|---|---|---|---|---|---|---|
| Opus 4.7 | `claude-opus-4-7` | not yet published (alias is stable) | $5 / $25 | 1M tokens | 128k tokens | **No** (budget_tokens → 400 error) | **Yes** (set `{type:"adaptive"}`) | Current flagship |
| Sonnet 4.6 | `claude-sonnet-4-6` | not yet published (alias is stable) | $3 / $15 | 1M tokens | 64k tokens | **Yes** (up to 64k budget_tokens) | Yes | Current recommended Sonnet |
| Haiku 4.5 | `claude-haiku-4-5` | `claude-haiku-4-5-20251001` | $1 / $5 | 200k tokens | 64k tokens | **Yes** (up to 64k budget_tokens) | No | Current lightweight model |
| Sonnet 4.0 | `claude-sonnet-4-20250514` | — | — | — | — | — | — | **DEPRECATED June 15 2026** |
| Opus 4.0 | `claude-opus-4-20250514` | — | — | — | — | — | — | **DEPRECATED June 15 2026** |

**Confidence: HIGH** — sourced from official Anthropic models overview page (docs.anthropic.com/en/docs/about-claude/models/overview).

**Important alias note:** `claude-opus-4-7` and `claude-sonnet-4-6` are the current alias forms (no snapshot date suffix visible in the models page). The docs page listed these as the "Claude API alias" row. Use the alias unless you need to pin a specific snapshot.

### Knowledge Cutoffs (relevant for Phase 0 research quality)
| Model | Reliable Knowledge Cutoff | Training Data Cutoff |
|---|---|---|
| Opus 4.7 | Jan 2026 | Jan 2026 |
| Sonnet 4.6 | Aug 2025 | Jan 2026 |
| Haiku 4.5 | Feb 2025 | Jul 2025 |

**Implication for Phase 0 (customer research):** Haiku 4.5's Feb 2025 knowledge cutoff makes it unsuitable for Phase 0 — it may miss recent org news, recent site changes, or technology shifts. Sonnet 4.6 (Aug 2025 reliable cutoff) is acceptable for research phases that supplement with WebSearch/WebFetch tool calls.

---

## Architecture Patterns

### Recommended Model-Routing Table

| Phase | Phase Name | Current Model | Recommended Model | Rationale |
|---|---|---|---|---|
| 0 | Customer & site research | `claude-sonnet-4-20250514` | `claude-sonnet-4-6` | Web research + structured markdown output; moderate complexity. Sonnet 4.6 is the right tier. Haiku's knowledge cutoff (Feb 2025) is too stale for research. |
| 1 | TOR analysis & question drafting | `claude-sonnet-4-20250514` | `claude-sonnet-4-6` | Moderate-high complexity; large TOR documents fit within 1M context window of Sonnet 4.6. No change in tier needed. |
| 1A | Optimistic estimation (CARL rules) | `claude-opus-4-20250514` (via OPUS_PHASES) | `claude-opus-4-7` | Highest complexity, full estimation with CARL rules. Upgrade to Opus 4.7. **Requires thinking API change** (see below). |
| 2 | Response integration | `claude-sonnet-4-20250514` | `claude-sonnet-4-6` | Moderate complexity, response mapping. Sonnet 4.6 is correct tier. |
| 3 | Estimate review | `claude-opus-4-20250514` (via OPUS_PHASES) | `claude-opus-4-7` | High complexity multi-pass review. Upgrade to Opus 4.7. **Requires thinking API change**. |
| 3R | Structured critique (aiJsonCall) | `claude-sonnet-4-20250514` (hardcoded in ai-with-retry.ts) | `claude-sonnet-4-6` | Single structured JSON call, no thinking needed. Update hardcoded string in `aiJsonCall` callers. |
| 4 | Gap analysis | `claude-opus-4-20250514` (via OPUS_PHASES) | `claude-opus-4-7` | High complexity, requirement tracing. Upgrade to Opus 4.7. **Requires thinking API change**. |
| 5 | Knowledge capture | `claude-sonnet-4-20250514` | `claude-haiku-4-5-20251001` | Low complexity, structured capture of learnings. Haiku 4.5 is sufficient and 3x cheaper. No tool-use required; knowledge cutoff not critical since it's writing to storage, not researching. |

### Constants to Define in agent.ts

```typescript
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const OPUS_MODEL = "claude-opus-4-7";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const OPUS_PHASES = new Set(["1A", "3", "4"]);
const HAIKU_PHASES = new Set(["5"]);

function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  if (HAIKU_PHASES.has(String(config.phase))) return HAIKU_MODEL;
  return DEFAULT_MODEL;
}
```

### Critical: Thinking API Change for Opus 4.7

The current `buildThinkingParam()` uses `{ thinking: { type: "enabled", budget_tokens: 8000 } }`. This **will return a 400 error** on `claude-opus-4-7`.

Opus 4.7 uses adaptive thinking only:

```typescript
// OLD (Opus 4.0/4.5/4.6 — breaks on Opus 4.7)
{ thinking: { type: "enabled", budget_tokens: 8000 } }

// NEW (Opus 4.7)
{ thinking: { type: "adaptive" } }

// For Sonnet 4.6 / Haiku 4.5 (if extended thinking wanted — optional)
{ thinking: { type: "enabled", budget_tokens: 8000 } }
```

Updated `buildThinkingParam()` must distinguish between Opus 4.7 (adaptive) and other models that support extended thinking (Sonnet 4.6, Haiku 4.5 can use `budget_tokens`):

```typescript
function buildThinkingParam(model: string): { thinking?: object } {
  if (model === OPUS_MODEL) {
    // Opus 4.7: adaptive thinking (no budget_tokens)
    return { thinking: { type: "adaptive" } };
  }
  // Sonnet 4.6 / Haiku 4.5: extended thinking available but not required
  // For current phase assignments: only enable on Opus phases, not others
  return {};
}
```

**Decision:** Keep extended/adaptive thinking only on Opus phases (1A, 3, 4). Do not add extended thinking to Sonnet or Haiku phases — it adds latency and cost without clear benefit for research/capture phases.

### ai-with-retry.ts: Hardcoded Model for 3R

`aiJsonCall` callers (Phase 3R critique) have the model passed as a parameter. The call site that sets `model: "claude-sonnet-4-20250514"` must be updated to `"claude-sonnet-4-6"`. Search for `claude-sonnet-4-20250514` in `ai-with-retry.ts` call sites across the codebase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Model routing logic | Custom per-phase config system | Extend existing `getModelForPhase()` in agent.ts | Already has the right structure; just update constants and add HAIKU_PHASES |
| Thinking parameter construction | Inline thinking objects per call site | Extend existing `buildThinkingParam()` | Single function already used in the agentic loop |
| Model override UI | New routing layer | Use existing `config.model` override field on `PhaseConfig` | Already supported — Tier 2 UI just sets this field |

---

## Common Pitfalls

### Pitfall 1: Using budget_tokens with Opus 4.7
**What goes wrong:** `thinking: { type: "enabled", budget_tokens: 8000 }` returns HTTP 400 on `claude-opus-4-7`.
**Why it happens:** Opus 4.7 replaced extended thinking with adaptive thinking; the API parameter shape changed.
**How to avoid:** Check model identity in `buildThinkingParam()` and return `{ thinking: { type: "adaptive" } }` for Opus 4.7, not `budget_tokens`.
**Warning signs:** 400 errors from the Anthropic API immediately after model upgrade.

### Pitfall 2: Deprecated model IDs after June 15 2026
**What goes wrong:** Any call using `claude-sonnet-4-20250514` or `claude-opus-4-20250514` returns an API error (not a fallback) after June 15, 2026.
**Why it happens:** Hard deprecation — no grace period, no silent redirect.
**How to avoid:** Update all hardcoded model ID strings. Search the entire `tool/src/` directory for `20250514`.
**Warning signs:** All AI phases fail simultaneously in production.

### Pitfall 3: Haiku 4.5 on Phase 0 (research)
**What goes wrong:** Phase 0 (customer research) with Haiku 4.5 may miss recent customer news, recent technology choices, or 2025 events because Haiku's reliable knowledge cutoff is Feb 2025.
**Why it happens:** Haiku 4.5 has an older training cutoff than Sonnet 4.6.
**How to avoid:** Keep Phase 0 on Sonnet 4.6, not Haiku. Haiku is only appropriate for Phase 5 (knowledge capture) which writes structured data, not researches it.

### Pitfall 4: CLAUDE_MODEL env var overrides phase routing
**What goes wrong:** If `CLAUDE_MODEL` is set in the environment, `getModelForPhase()` returns it for ALL phases (including Opus phases), bypassing per-phase routing.
**Why it happens:** Current code: `if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;` — no phase check.
**How to avoid:** Document this behavior; the env var is a development override. For production, leave `CLAUDE_MODEL` unset to get per-phase routing.

### Pitfall 5: Haiku 4.5 context window for Phase 5
**What goes wrong:** Phase 5 system prompt + benchmarks + TOR context could exceed Haiku's 200k token limit if a very large engagement is passed.
**Why it happens:** Haiku 4.5 has a 200k context window vs 1M for Sonnet/Opus.
**How to avoid:** Phase 5 (knowledge capture) works with summaries and learnings, not full TOR documents — token usage should be well under 200k. Monitor `UsageStats.inputTokens` for Phase 5; alert if approaching 180k.

---

## Code Examples

### Updated agent.ts constants and getModelForPhase

```typescript
// Source: Anthropic models overview (docs.anthropic.com/en/docs/about-claude/models/overview)
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const OPUS_MODEL = "claude-opus-4-7";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const OPUS_PHASES = new Set(["1A", "3", "4"]);
const HAIKU_PHASES = new Set(["5"]);

function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;            // Per-engagement override (Tier 2 UI)
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL; // Dev override
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  if (HAIKU_PHASES.has(String(config.phase))) return HAIKU_MODEL;
  return DEFAULT_MODEL;
}

function buildThinkingParam(model: string): { thinking?: object } {
  if (model === OPUS_MODEL) {
    // Opus 4.7 uses adaptive thinking — budget_tokens will return 400
    return { thinking: { type: "adaptive" } };
  }
  return {}; // No extended thinking for Sonnet/Haiku phases
}
```

### Updated 3R model in aiJsonCall call site

```typescript
// In the Phase 3R critique caller — update from:
model: "claude-sonnet-4-20250514"
// To:
model: "claude-sonnet-4-6"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `claude-sonnet-4-20250514` (Sonnet 4.0) | `claude-sonnet-4-6` | Feb 2026 | Better reasoning, same pricing tier |
| `claude-opus-4-20250514` (Opus 4.0) | `claude-opus-4-7` | Apr 2026 | Adaptive thinking replaces budget_tokens extended thinking |
| Extended thinking: `{type:"enabled", budget_tokens: N}` | Adaptive thinking: `{type:"adaptive"}` (Opus 4.7 only) | Apr 2026 | Breaking API change — budget_tokens → 400 error on Opus 4.7 |
| No Haiku tier | Haiku 4.5 for low-complexity phases | Oct 2025 | 3x cost reduction for Phase 5 |

**Deprecated/outdated:**
- `claude-sonnet-4-20250514`: Hard deprecated June 15, 2026 (API errors)
- `claude-opus-4-20250514`: Hard deprecated June 15, 2026 (API errors)
- `thinking: {type:"enabled", budget_tokens: N}` on Opus 4.7: Returns 400 immediately

---

## Open Questions

1. **Opus 4.7 snapshot ID**
   - What we know: The alias `claude-opus-4-7` is confirmed stable; docs show no snapshot suffix in the current models table.
   - What's unclear: Whether a snapshot ID (e.g., `-20260416`) exists yet on the API. Alias is safe to use.
   - Recommendation: Use the alias `claude-opus-4-7` — it is the "Claude API alias" per official docs.

2. **Sonnet 4.6 snapshot ID**
   - What we know: The alias `claude-sonnet-4-6` is confirmed. Snapshot suffix format is not visible in search results.
   - What's unclear: Exact snapshot date. Some sources suggest `-20260220` but this was not confirmed from official docs.
   - Recommendation: Use the alias `claude-sonnet-4-6`.

3. **Per-engagement model override UI contract**
   - What we know: `PhaseConfig.model` field already exists and `getModelForPhase()` checks it first.
   - What's unclear: Whether the Tier 2 UI should expose model selection per-phase or globally per-engagement.
   - Recommendation: Wire the UI override to set `PhaseConfig.model` — the infrastructure already exists.

4. **Adaptive thinking on Sonnet/Haiku phases**
   - What we know: Sonnet 4.6 supports extended thinking (`budget_tokens`). Haiku 4.5 also supports it.
   - What's unclear: Whether Phase 0 or Phase 1 benefit from enabling extended thinking.
   - Recommendation: Do not enable extended thinking on non-Opus phases for now. It adds latency and cost; re-evaluate based on quality metrics after deployment.

---

## Implementation Checklist for Planner

These are the exact code changes required:

1. **`tool/src/lib/ai/agent.ts`**
   - Update `DEFAULT_MODEL` constant: `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"`
   - Update `OPUS_MODEL` constant: `"claude-opus-4-20250514"` → `"claude-opus-4-7"`
   - Add `HAIKU_MODEL` constant: `"claude-haiku-4-5-20251001"`
   - Add `HAIKU_PHASES` set: `new Set(["5"])`
   - Update `getModelForPhase()`: add Haiku branch before default return
   - Update `buildThinkingParam()`: Opus 4.7 gets `{type:"adaptive"}`, others get `{}`

2. **`tool/src/lib/ai/ai-with-retry.ts` (and call sites)**
   - Search entire `tool/src/` for `claude-sonnet-4-20250514` and `claude-opus-4-20250514`
   - Replace all occurrences with current model IDs
   - The `aiJsonCall` `opts.model` parameter at Phase 3R call site must be `"claude-sonnet-4-6"`

3. **`tool/prisma/schema.prisma` / `UsageStats`**
   - No schema changes required; `modelId` is already a string field in `UsageStats`

4. **Tests**
   - After changes, run `cd tool && npm run test:unit && npm run test:integration` per CLAUDE.md test enforcement rules

---

## Sources

### Primary (HIGH confidence)
- [Models overview — Anthropic Claude API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) — model IDs, pricing, context windows, extended/adaptive thinking support, deprecation status
- [Model deprecations — Anthropic Claude Docs](https://docs.claude.com/en/docs/about-claude/model-deprecations) — June 15, 2026 hard deprecation of `claude-sonnet-4-20250514` and `claude-opus-4-20250514`

### Secondary (MEDIUM confidence)
- [What's new in Claude Opus 4.7 — Anthropic](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7) — adaptive thinking vs. extended thinking distinction
- [Claude 4 Deprecation: Sonnet 4 and Opus 4 Retire June 15, 2026 — Tygart Media](https://tygartmedia.com/claude-4-deprecation/) — confirmed deprecation timeline
- [Claude Opus 4.7 — Anthropic News](https://www.anthropic.com/news/claude-opus-4-7) — official release announcement
- [Introducing Claude Sonnet 4.6 — Anthropic News](https://www.anthropic.com/news/claude-sonnet-4-6) — official release announcement
- [Claude Haiku 4.5 API Model ID — TypingMind](https://www.typingmind.com/guide/anthropic/claude-haiku-4-5-20251001) — snapshot ID `claude-haiku-4-5-20251001` confirmed

### Tertiary (LOW confidence — marked for validation)
- Sonnet 4.6 snapshot ID with date suffix: unconfirmed, use alias `claude-sonnet-4-6`
- Opus 4.7 snapshot ID with date suffix: unconfirmed, use alias `claude-opus-4-7`

---

## Metadata

**Confidence breakdown:**
- Model IDs and pricing: HIGH — sourced directly from official Anthropic docs page HTML
- Deprecation deadline (June 15, 2026): HIGH — multiple official and confirmed secondary sources
- Adaptive thinking API shape for Opus 4.7: HIGH — confirmed from official what's-new docs
- Snapshot date suffixes for Opus 4.7 / Sonnet 4.6: LOW — aliases confirmed, snapshot dates unconfirmed
- Haiku 4.5 suitability for Phase 5: HIGH — capability and knowledge cutoff analysis from official specs

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days — stable spec, but deprecation deadline is June 15, so act before then)
