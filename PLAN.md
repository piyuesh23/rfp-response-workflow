# Plan: Improve Estimate Consistency via Benchmark Enforcement

**Created:** 2026-04-08
**Status:** COMPLETE
**Scope:** Phase 1A (and Phase 3/3R) estimate generation consistency

---

## Problem Statement

Estimates generated in multiple runs for the same TOR vary significantly because benchmarks are injected as advisory markdown text — Claude pattern-matches but has no structural enforcement. Root causes:

1. **Fuzzy injection format** — Benchmarks are injected as `### Category\n- **taskType**: X–Y hrs` markdown. Claude reads it but has no lookup mechanism to bind line items to specific benchmarks.
2. **No deviation enforcement** — CARL Rule 6 says "compare against benchmarks/ranges" but provides no structured way to enforce this — the agent can drift without consequences.
3. **No cross-run calibration** — Each run sees the same benchmarks but no memory of prior estimate values, so the calibration baseline resets every generation.
4. **No post-generation validation** — After output, no service checks line-item hours against benchmark ranges.

---

## Acceptance Criteria

- [ ] Each estimate line item explicitly cites the benchmark task type it was calibrated against (or "N/A – no matching benchmark")
- [ ] Estimates generated from the same TOR (no new inputs) vary by ≤ 15% on any single line item
- [ ] Deviations > 25% from benchmark mid-point require a written justification in the estimate
- [ ] A validation report is generated alongside the estimate showing pass/warn/fail per line item
- [ ] No regression: existing estimate format (4 tabs, Conf buffer formula) is preserved

---

## Implementation Steps

### Step 1 — Structured Benchmark Injection (agent.ts) `[DONE]`

**File:** `tool/src/lib/ai/agent.ts`, `loadBenchmarks()` function (lines 61-88)

**Change:** Replace free-form markdown grouping with a keyed lookup table format:

```
## Reference Benchmarks — Lookup Table

| BenchmarkKey | Category | TaskType | TechStack | Tier | LowHrs | HighHrs | Notes |
|---|---|---|---|---|---|---|---|
| drupal-content-type-simple | Content Architecture | Simple content type | Drupal | - | 4 | 8 | ... |
| drupal-integration-t1 | Integrations | T1 Simple integration | Drupal | T1 | 8 | 16 | ... |
...

## How to Use These Benchmarks
- For each estimate line item, identify the closest BenchmarkKey
- Your estimated Hours MUST fall within LowHrs–HighHrs unless you provide an explicit deviation justification
- If no benchmark matches, set BenchmarkRef = "N/A" and explain why
- Deviations > 25% from (LowHrs+HighHrs)/2 MUST be flagged in the line item's Assumptions column as: "BENCHMARK DEVIATION: [reason]"
```

**Files to change:**
- `tool/src/lib/ai/agent.ts` — `loadBenchmarks()`: change `lines.push()` format from markdown bullets to table rows
- `tool/src/lib/ai/agent.ts` — wrapper text: replace "Use these effort ranges to calibrate" with explicit lookup table instructions

---

### Step 3 — CARL Rule Update `[DONE]`

**File:** `tool/src/lib/ai/prompts/carl-rules.ts`

**Change:** Strengthen RULE 6 from:
> "Compare figures against benchmarks/ ranges"

To:
> "RULE 6 (BENCHMARK COMPLIANCE): Every Backend and Frontend line item MUST include a BenchmarkRef column value. Hours outside the matched benchmark range require an explicit 'BENCHMARK DEVIATION:' annotation in Assumptions. A deviation summary is REQUIRED at the end of the estimate."

**Files to change:**
- `tool/src/lib/ai/prompts/carl-rules.ts` — Update RULE 6

---

### Step 2 — Mandate BenchmarkRef in Estimate Line Items `[DONE]`

**File:** `tool/src/lib/ai/prompts/phase-prompts.ts`, `getPhase1AEstimatePrompt()` (lines 71-140)

**Change:** Add a `BenchmarkRef` column to all Backend/Frontend estimate tables:

| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions | ... |

**Instruction additions:**
- "For each line item, set BenchmarkRef to the BenchmarkKey from the Reference Benchmarks table. If no key applies, write 'N/A'."
- "If Hours is outside LowHrs–HighHrs for the matched benchmark, prepend 'BENCHMARK DEVIATION: [reason]' to the Assumptions column."

**Files to change:**
- `tool/src/lib/ai/prompts/phase-prompts.ts` — Update Phase 1A user prompt to include BenchmarkRef column instruction
- `templates/optimistic-estimate-template.md` — Add BenchmarkRef column to Backend and Frontend table headers

---

### Step 4 — Post-Generation Validation Pass `[DONE]`

**New file:** `tool/src/lib/ai/phases/phase-validate-estimate.ts`

**Validation logic (TypeScript, not AI):**
1. Parse the generated estimate markdown — extract all line items from Backend and Frontend tabs
2. For each line item: look up `BenchmarkRef` in the benchmarks DB
3. Compute deviation: `deviation = (hours - mid) / mid * 100` where `mid = (lowHrs + highHrs) / 2`
4. Flag: `PASS` (within range), `WARN` (1-25% deviation), `FAIL` (>25% deviation, no justification)
5. Write a validation report alongside the estimate

**New API endpoint:** `POST /api/engagements/[id]/phases/[phaseNumber]/validate`
- Reads latest artefact contentMd
- Runs TypeScript validation (no AI needed)
- Returns `{ passCount, warnCount, failCount, items: [{task, benchmarkRef, hours, expected, deviation, status}] }`

**UI:** Add a "Validation" badge in the artefact viewer showing pass/warn/fail counts.

**Files to create:**
- `tool/src/lib/ai/phases/validate-estimate.ts`
- `tool/src/app/api/engagements/[id]/phases/[phaseNumber]/validate/route.ts`

**Files to change:**
- `tool/src/workers/phase-runner.ts` — trigger validation after Phase 1A/3 artefact is written
- `tool/src/app/engagements/[id]/page.tsx` — show validation badge on estimate tab cards

---

### Step 5 — Prior Estimate Anchoring (Cross-Run Calibration) `[DONE]`

**File:** `tool/src/lib/ai/agent.ts`, `collectPriorContext()` (lines 159-202)

**Change:** If a prior estimate exists for the same engagement, inject the previous estimate's line-item totals into the Phase 1A context as an anchoring reference.

**Implementation:**
- In `collectPriorContext()`, check if `estimates/optimistic-estimate.md` already exists
- If it does, extract total hours from the `<!-- OPTIMISTIC-ESTIMATE-STATE -->` block or Coverage Summary
- Inject as an additional context section in the user prompt

**Files to change:**
- `tool/src/lib/ai/agent.ts` — `collectPriorContext()` to detect and extract prior estimate totals
- `tool/src/lib/ai/prompts/phase-prompts.ts` — reference prior estimate when available

---

## Implementation Order

| Priority | Step | Effort | Impact |
|---|---|---|---|
| 1 (this PR) | Step 1 — Structured benchmark table format | 1h | High — immediate |
| 1 (this PR) | Step 3 — CARL Rule 6 update | 15m | High — immediate |
| 2 (next PR) | Step 2 — BenchmarkRef column | 2h | High — requires template + prompt changes |
| 2 (next PR) | Step 4 — Post-generation validation | 4h | High — adds objective quality gate |
| 3 (later) | Step 5 — Prior estimate anchoring | 2h | Medium — reduces run-to-run variance |

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Tabular benchmark format breaks markdown parsing | Use pipe-delimited tables (standard markdown); test with current estimate template parser |
| BenchmarkRef column breaks existing artefact metadata extraction | The metadata extractor uses regex on `totalHours`/`hoursByTab`, not column headers — safe |
| Validation pass adds latency | Validation is TypeScript-only (no AI call) — sub-100ms |
| Prior estimate anchoring biases toward stale data | Only inject when re-running for same engagement; prompt explicitly says "do NOT copy blindly" |

---

## Verification Steps

1. Run Phase 1A twice for the same engagement without any input changes
2. Compare line-item hours — variance should be ≤ 15% for any item with a matched benchmark
3. Check that every Backend/Frontend line item has a non-empty BenchmarkRef column
4. Check that any Hours outside benchmark range has "BENCHMARK DEVIATION:" in Assumptions
5. Validation report should show ≥ 80% PASS items for a well-scoped TOR
6. TypeScript build passes: `cd tool && npm run build`
