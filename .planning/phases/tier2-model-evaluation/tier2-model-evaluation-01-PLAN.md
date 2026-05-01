---
phase: tier2-model-evaluation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tool/src/lib/ai/agent.ts
  - tool/src/lib/ai/phase3r-critique.ts
  - tool/src/lib/ai/phases/phase5-capture.ts
  - tool/src/app/api/engagements/infer/route.ts
  - tool/src/app/api/chat/route.ts
  - tool/src/lib/template-populator.ts
  - tool/src/lib/ai/extract-deliverables.ts
  - tool/src/lib/ai/gap-fix-patch.ts
  - tool/src/lib/ai/infer-engagement.ts
  - tool/src/workers/tech-stack-research.ts
  - tool/src/workers/phase-runner.ts
autonomous: true
requirements: [MODEL-ROUTING-01, MODEL-ROUTING-02, MODEL-ROUTING-03, MODEL-ROUTING-04, MODEL-ROUTING-05]

must_haves:
  truths:
    - "No occurrence of claude-sonnet-4-20250514 or claude-opus-4-20250514 remains in tool/src/"
    - "Opus 4.7 phases (1A, 3, 4) use adaptive thinking — no budget_tokens field"
    - "Phase 5 routes to claude-haiku-4-5-20251001, not Opus or Sonnet"
    - "Phase 3R critique call uses claude-sonnet-4-6"
    - "phase-runner.ts pricing map has current model IDs as keys"
    - "npm run test:unit and npm run test:integration both pass"
  artifacts:
    - path: "tool/src/lib/ai/agent.ts"
      provides: "Updated model constants, getModelForPhase, buildThinkingParam"
      contains: "claude-sonnet-4-6"
    - path: "tool/src/lib/ai/phase3r-critique.ts"
      provides: "Updated hardcoded model ID in aiJsonCall"
      contains: "claude-sonnet-4-6"
    - path: "tool/src/lib/ai/phases/phase5-capture.ts"
      provides: "Phase 5 config uses Haiku, not Opus"
      contains: "claude-haiku-4-5-20251001"
    - path: "tool/src/workers/phase-runner.ts"
      provides: "Pricing map keys match current model IDs"
      contains: "claude-opus-4-7"
  key_links:
    - from: "getModelForPhase()"
      to: "HAIKU_PHASES set"
      via: "HAIKU_PHASES.has(String(config.phase))"
      pattern: "HAIKU_PHASES\\.has"
    - from: "buildThinkingParam()"
      to: "claude-opus-4-7 constant"
      via: "model === OPUS_MODEL check"
      pattern: "type.*adaptive"
---

<objective>
Migrate all deprecated model IDs off `claude-sonnet-4-20250514` and `claude-opus-4-20250514`
before the hard API deprecation on June 15, 2026, and update the Opus thinking API for 4.7's
adaptive thinking shape.

Purpose: Prevent production failures when Anthropic hard-deprecates both model IDs. Simultaneously
route Phase 5 to Haiku 4.5 for cost savings (~3x cheaper), update Phase 3R's hardcoded model,
and fix the pricing map so cost accounting doesn't return 0 post-migration.

Output: Updated agent.ts (model constants + getModelForPhase + buildThinkingParam),
phase3r-critique.ts (aiJsonCall model param), phase5-capture.ts (direct model override),
phase-runner.ts (pricing map keys), and 7 additional files with local SONNET_MODEL constants.
Test suite green.
</objective>

<execution_context>
@/Users/piyuesh23/.claude/get-shit-done/workflows/execute-plan.md
@/Users/piyuesh23/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/tier2-model-evaluation/RESEARCH.md

<interfaces>
<!-- Key signatures the executor needs. Extracted from agent.ts lines 44-65. -->

Current constants (lines 44-49 of agent.ts):
```typescript
const DEFAULT_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const OPUS_MODEL = "claude-opus-4-20250514";
const OPUS_PHASES = new Set(["1A", "3", "4"]);
```

Current buildThinkingParam (lines 51-54):
```typescript
function buildThinkingParam(model: string): { thinking?: { type: "enabled"; budget_tokens: number } } {
  if (model !== OPUS_MODEL) return {};
  return { thinking: { type: "enabled", budget_tokens: 8000 } };
}
```

Current getModelForPhase (lines 60-65):
```typescript
function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  return DEFAULT_MODEL;
}
```

Phase 3R hardcoded model (phase3r-critique.ts line 108):
```typescript
model: "claude-sonnet-4-20250514",
```

Phase 5 direct model override (phase5-capture.ts line 343):
```typescript
model: "claude-opus-4-20250514",
```
Note: This is NOT going through getModelForPhase(). It is a direct override in the PhaseConfig
object. Per checker guidance, replace with "claude-haiku-4-5-20251001" (Phase 5 is low-complexity
knowledge capture — Haiku is appropriate).

phase-runner.ts pricing map (lines 65-68):
```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
};
```
After migration, these keys will never match and cost accounting returns 0. Must update keys.

Local SONNET_MODEL pattern (7 files):
```typescript
const SONNET_MODEL = "claude-sonnet-4-20250514";
// or
const CHAT_MODEL = "claude-sonnet-4-20250514";
```
Each file declares its own constant — a mechanical one-liner replacement per file.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update model constants, getModelForPhase, and buildThinkingParam in agent.ts</name>
  <files>tool/src/lib/ai/agent.ts</files>
  <action>
Make four targeted edits to agent.ts. All edits are in the constants/function block at lines 44-65.

**Edit 1 — DEFAULT_MODEL constant (lines 44-45):**
Replace:
```typescript
const DEFAULT_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
```
With:
```typescript
const DEFAULT_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
```

**Edit 2 — OPUS_MODEL and add HAIKU_MODEL (lines 46-49):**
Replace:
```typescript
const OPUS_MODEL = "claude-opus-4-20250514";

/** Phases that need Opus-level generation. 3R is critique-only → Sonnet. */
const OPUS_PHASES = new Set(["1A", "3", "4"]);
```
With:
```typescript
const OPUS_MODEL = "claude-opus-4-7";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** Phases that need Opus-level generation. 3R is critique-only → Sonnet. */
const OPUS_PHASES = new Set(["1A", "3", "4"]);
/** Phases that use Haiku for cost savings (low-complexity structured output). */
const HAIKU_PHASES = new Set(["5"]);
```

**Edit 3 — buildThinkingParam return type and body (lines 51-54):**
Replace:
```typescript
function buildThinkingParam(model: string): { thinking?: { type: "enabled"; budget_tokens: number } } {
  if (model !== OPUS_MODEL) return {};
  return { thinking: { type: "enabled", budget_tokens: 8000 } };
}
```
With:
```typescript
function buildThinkingParam(model: string): { thinking?: object } {
  if (model === OPUS_MODEL) {
    // Opus 4.7 uses adaptive thinking — budget_tokens causes a 400 error
    return { thinking: { type: "adaptive" } };
  }
  // No extended thinking for Sonnet/Haiku phases (latency vs. quality tradeoff)
  return {};
}
```

**Edit 4 — getModelForPhase: add Haiku branch (lines 60-65):**
Replace:
```typescript
function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  return DEFAULT_MODEL;
}
```
With:
```typescript
function getModelForPhase(config: PhaseConfig): string {
  if (config.model) return config.model;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (OPUS_PHASES.has(String(config.phase))) return OPUS_MODEL;
  if (HAIKU_PHASES.has(String(config.phase))) return HAIKU_MODEL;
  return DEFAULT_MODEL;
}
```

Do NOT change anything else in agent.ts.
  </action>
  <verify>
    <automated>
grep -n "claude-sonnet-4-20250514\|claude-opus-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts && echo "FAIL: deprecated IDs still present" || echo "PASS: no deprecated IDs"
grep -n "claude-sonnet-4-6\|claude-opus-4-7\|claude-haiku-4-5-20251001" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts
grep -n "type.*adaptive" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts
grep -n "HAIKU_PHASES" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts
    </automated>
  </verify>
  <done>
- DEFAULT_MODEL falls back to "claude-sonnet-4-6"
- OPUS_MODEL is "claude-opus-4-7"
- HAIKU_MODEL constant "claude-haiku-4-5-20251001" exists
- HAIKU_PHASES set ["5"] exists and is checked in getModelForPhase
- buildThinkingParam returns {thinking:{type:"adaptive"}} for OPUS_MODEL, {} otherwise
- Zero occurrences of 20250514 in agent.ts
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix phase3r-critique.ts, phase5-capture.ts, and phase-runner.ts pricing map</name>
  <files>tool/src/lib/ai/phase3r-critique.ts, tool/src/lib/ai/phases/phase5-capture.ts, tool/src/workers/phase-runner.ts</files>
  <action>
Three targeted edits across three files.

**Edit A — phase3r-critique.ts line 108:**
Replace:
```typescript
    model: "claude-sonnet-4-20250514",
```
With:
```typescript
    model: "claude-sonnet-4-6",
```

**Edit B — phase5-capture.ts line 343:**
Replace:
```typescript
    model: "claude-opus-4-20250514",
```
With:
```typescript
    model: "claude-haiku-4-5-20251001",
```
Rationale: Phase 5 is knowledge capture (low-complexity structured output). Haiku is appropriate
and ~3x cheaper. This is a direct model override in the PhaseConfig object — it bypasses
getModelForPhase(), so updating agent.ts alone would not fix this call site.

**Edit C — phase-runner.ts lines 65-68, MODEL_PRICING map:**
Replace:
```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
};
```
With:
```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};
```
Haiku 4.5 pricing: $0.80/MTok input, $4/MTok output (current Anthropic pricing as of May 2026).
  </action>
  <verify>
    <automated>
grep -n "claude-sonnet-4-20250514\|claude-opus-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/phase3r-critique.ts && echo "FAIL" || echo "PASS: phase3r-critique clean"
grep -n "claude-sonnet-4-20250514\|claude-opus-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/phases/phase5-capture.ts && echo "FAIL" || echo "PASS: phase5-capture clean"
grep -n "claude-haiku-4-5-20251001" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/phases/phase5-capture.ts
grep -n "claude-opus-4-20250514\|claude-sonnet-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/workers/phase-runner.ts && echo "FAIL" || echo "PASS: phase-runner pricing map clean"
grep -n "claude-opus-4-7\|claude-sonnet-4-6\|claude-haiku-4-5-20251001" /Users/piyuesh23/Operational/presales/_template/tool/src/workers/phase-runner.ts
    </automated>
  </verify>
  <done>
- phase3r-critique.ts uses "claude-sonnet-4-6"
- phase5-capture.ts uses "claude-haiku-4-5-20251001"
- phase-runner.ts MODEL_PRICING keys are "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"
- No 20250514 strings in any of the three files
  </done>
</task>

<task type="auto">
  <name>Task 3: Sweep remaining deprecated Sonnet IDs across 7 files and run tests</name>
  <files>tool/src/app/api/engagements/infer/route.ts, tool/src/app/api/chat/route.ts, tool/src/lib/template-populator.ts, tool/src/lib/ai/extract-deliverables.ts, tool/src/lib/ai/gap-fix-patch.ts, tool/src/lib/ai/infer-engagement.ts, tool/src/workers/tech-stack-research.ts</files>
  <action>
Each of these files declares a local constant with the deprecated Sonnet model ID. Perform a
mechanical one-liner replacement in each file. No logic changes required.

| File | Variable name | Change |
|------|--------------|--------|
| tool/src/app/api/engagements/infer/route.ts | `SONNET_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/app/api/chat/route.ts | `CHAT_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/lib/template-populator.ts | (two occurrences) | both `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/lib/ai/extract-deliverables.ts | `SONNET_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/lib/ai/gap-fix-patch.ts | `SONNET_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/lib/ai/infer-engagement.ts | `SONNET_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |
| tool/src/workers/tech-stack-research.ts | `SONNET_MODEL` | `"claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"` |

For each file: open it, find the exact string `"claude-sonnet-4-20250514"`, replace with
`"claude-sonnet-4-6"`. The variable name (SONNET_MODEL, CHAT_MODEL) stays unchanged.

After all replacements, run the full codebase-wide check:

```bash
grep -rn "claude-sonnet-4-20250514\|claude-opus-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/ | grep -v "\.test\." | grep -v "PLAN\|RESEARCH\|SUMMARY"
```

This must return zero lines. If any additional hits appear, replace them with the appropriate
current alias before proceeding.

Then run both required test suites:

```bash
cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit
cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:integration
```

Both must pass before marking this task done. Include the test output summary in SUMMARY.md.
  </action>
  <verify>
    <automated>
grep -rn "claude-sonnet-4-20250514\|claude-opus-4-20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/ | grep -v "\.test\." | grep -v "PLAN\|RESEARCH\|SUMMARY" && echo "FAIL: deprecated IDs remain" || echo "PASS: zero deprecated IDs in production src/"
cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit && npm run test:integration
    </automated>
  </verify>
  <done>
- All 7 files updated: deprecated Sonnet ID replaced with "claude-sonnet-4-6"
- grep for 20250514 across tool/src/ production files returns zero lines
- npm run test:unit passes
- npm run test:integration passes
  </done>
</task>

</tasks>

<verification>
Full verification after all three tasks:

```bash
# 1. No deprecated IDs anywhere in src/ (production files only)
grep -rn "20250514" /Users/piyuesh23/Operational/presales/_template/tool/src/ | grep -v "\.test\." | grep -v "PLAN\|RESEARCH\|SUMMARY" || echo "Clean"

# 2. Correct constants in agent.ts
grep -n "DEFAULT_MODEL\|OPUS_MODEL\|HAIKU_MODEL\|HAIKU_PHASES\|OPUS_PHASES" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts

# 3. Adaptive thinking shape
grep -n "adaptive" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/agent.ts

# 4. Phase 3R model
grep -n "model:" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/phase3r-critique.ts

# 5. Phase 5 direct override uses Haiku
grep -n "model:" /Users/piyuesh23/Operational/presales/_template/tool/src/lib/ai/phases/phase5-capture.ts

# 6. Pricing map keys
grep -n "claude-" /Users/piyuesh23/Operational/presales/_template/tool/src/workers/phase-runner.ts

# 7. Tests
cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit && npm run test:integration
```
</verification>

<success_criteria>
- Zero occurrences of `claude-sonnet-4-20250514` or `claude-opus-4-20250514` in tool/src/ production files
- `DEFAULT_MODEL` falls back to `"claude-sonnet-4-6"`
- `OPUS_MODEL` is `"claude-opus-4-7"`; `HAIKU_MODEL` is `"claude-haiku-4-5-20251001"`
- `HAIKU_PHASES = new Set(["5"])` exists and is checked in `getModelForPhase()`
- `buildThinkingParam()` returns `{thinking:{type:"adaptive"}}` for Opus, `{}` for all other models
- `phase3r-critique.ts` aiJsonCall passes `model: "claude-sonnet-4-6"`
- `phase5-capture.ts` line 343 uses `"claude-haiku-4-5-20251001"` (not Opus, not Sonnet)
- `phase-runner.ts` MODEL_PRICING has keys `"claude-opus-4-7"`, `"claude-sonnet-4-6"`, `"claude-haiku-4-5-20251001"`
- `npm run test:unit` passes
- `npm run test:integration` passes
</success_criteria>

<output>
After completion, create `.planning/phases/tier2-model-evaluation/tier2-model-evaluation-01-SUMMARY.md`

Include:
- Changes made (file, line, before/after)
- Test output (pass/fail summary)
- Any additional deprecated IDs found and fixed beyond the planned files
</output>
