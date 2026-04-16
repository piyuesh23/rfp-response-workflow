# Plan — Accuracy & Alignment Review for Proposal / Estimate Generation

## Thesis

> "The core of this application is to generate *good* proposals and estimates, not save time.
> Estimates and technical proposals must be super well aligned to what the customer is asking for."

This plan audits the current TOR → Estimate → Proposal pipeline against that thesis, surfaces the
places where alignment can silently drift, and proposes prioritized fixes.

## Current Pipeline (as of commit a431d69)

| Phase | Inputs | AI role | Output | Validator |
|-------|--------|---------|--------|-----------|
| 0 Research | TOR + web | Senior Architect (due-diligence) | `research/customer-research.md` + 10 CSVs | none |
| 1 TOR Analysis | Full TOR + Phase 0 | Senior Requirements Analyst | `tor-assessment.md`, `questions.md` | none |
| 1A Optimistic Estimate | TOR Assessment + open questions | Senior [stack] Architect | `solution-architecture.md` → `optimistic-estimate.md` → populated XLSX | `validate-estimate.ts` (partial) |
| 2 Response Integration | Q&A + prior artefacts | Senior Architect | `response-analysis.md` | none |
| 3 Estimate Review | Estimate + TOR + Q&A (ralph-loop × 3) | Estimation Specialist | `estimate-review.md` | `validate-estimate.ts` |
| 4 Gap Analysis | Phase 3 output | generic prompt | `gap-analysis.md`, `revised-estimates.md` | **none** |
| 5 Proposal | TOR + Research + assessment + estimate + architecture + gap | Proposal writer | `technical-proposal.md` | `validate-proposal.ts` (partial) |

## Accuracy Gaps — evidence-backed

### Machine-enforced only partially

1. **No post-generation traceability check** — The Phase 1A prompt demands a Traceability Matrix
   (TOR requirement ID → estimate line item), but `validate-estimate.ts` never parses or verifies it.
   An AI-generated matrix claiming "100% coverage" is trusted without audit.
   *Evidence:* `src/lib/ai/validate-estimate.ts` has no parse of the matrix block.

2. **No orphan detector** — Estimate line items without a TOR requirement ID in the Description
   column pass validation silently. CARL rule #5 flags this in-prompt only.

3. **No gap detector** — TOR requirements with no matching estimate line item are not reported
   unless the AI voluntarily lists them. CARL rule #4 flags this in-prompt only.

4. **Conf → Low/High buffer formula is prompt-only** — CARL rule #14 mandates
   `High Hrs = Hours × (1 + buffer%)` where `buffer = {6:0%, 5:25%, 4:50%, 3:50%, 2:75%, 1:100%}`.
   No validator checks that the XLSX/markdown columns match the formula.
   *Evidence:* `validate-estimate.ts:258-276` only checks benchmark deviation, not this.

5. **Assumption format is under-validated** — CARL rule #18 mandates
   `"What: [assumption ref TOR/Q&A]. Impact if wrong: [effort/scope change]"`.
   Validator (`validate-estimate.ts:429-464`) only rejects *negative* references (internal
   artifacts) but never verifies positive structure: TOR section number, "Impact if wrong" clause.

### Structural weaknesses

6. **Phase 4 prompt is 2 sentences** — `getPhase4Prompt()` returns a minimal directive.
   Under context pressure, the AI may not re-read the full TOR; gap analysis becomes a reshuffle
   of Phase 3's summary. Phase 4 is supposed to be the safety net; it isn't.

7. **`solution-architecture.md` is optional at Phase 5** — The Phase 5 proposal prompt treats it
   as "if available". It is written during Phase 1A only; HAS_RESPONSE path (Q&A → estimate
   directly at Phase 3) may never create it. Proposal then has no pre-approved technical anchor.

8. **Proposal validator checks carry-forward, not requirement coverage** — `validate-proposal.ts`
   verifies that ≥80% of estimate assumptions and risks appear in the proposal. It does NOT check
   that the "Project Objectives" or "Understanding of Requirements" sections map back to TOR
   requirements. A proposal can omit 3 TOR objectives and still pass all checks.

9. **`BenchmarkRef` NO_BENCHMARK status is invisible** — `validate-estimate.ts:235-248` marks
   unmatched benchmarks as `NO_BENCHMARK` rather than FAIL. 50 line items with no benchmark can
   coexist with an overall PASS verdict. No surfaced count, no alert.

10. **Risk Register validation is fuzzy** — `validate-estimate.ts:474-495` does substring matching
    between Conf≤4 task names and a risk section. Format schema (Task|Tab|Conf|Risk|OpenQ|Action|HoursAtRisk)
    is never validated. Malformed rows pass silently.

### Silent fidelity loss

11. **Traceability lives in markdown only** — Line items, requirements, assumptions, risks all
    exist as prose in markdown. Structured IDs exist nowhere in the DB. You cannot SQL-query
    "which TOR requirements map to zero estimate lines?" at any point in the workflow.

12. **No schema-retry on AI output** — If Claude returns shorter/malformed JSON, most call sites
    return `null` or a stub. No retry with stricter schema. Bad outputs become silent nulls.

## Cross-check Coverage Matrix

| Dimension | Prompt says it? | Validator enforces? |
|-----------|-----------------|---------------------|
| TOR coverage by estimate | yes | no |
| Estimate coverage by TOR (orphans) | yes | no |
| Assumption → TOR section grounding | yes | no (only rejects internal refs) |
| Benchmark range comparison | yes | yes (±25% tolerance) |
| Conf buffer formula | yes | **no** |
| Integration tier T1/T2/T3 | yes | no (not in estimate, not in proposal) |
| Risk Register schema | yes | no (fuzzy keyword match only) |
| Assumption carry-forward to proposal | yes | yes (80% threshold) |
| TOR objectives → proposal Section 2 | yes | **no** |
| Architecture grounded in pre-approved design | yes | no (solution-architecture.md optional) |

## Prioritized Recommendations

### Tier 1 — Close the traceability loop (unblocks everything else)

**T1.1 Structured estimate records alongside markdown** — When Phase 1A/Phase 3 populates the XLSX,
also persist a `LineItem` table row per estimate entry with `{ tab, task, hours, conf, lowHrs,
highHrs, torRef, description, assumptionIds[], benchmarkRef }`. `torRef` is the foreign key into
a `TorRequirement` table populated from Phase 1. Downstream validators query the DB, not markdown.

**T1.2 TOR requirement registry** — Phase 1 (TOR Analysis) already categorizes requirements; add a
step that persists each requirement as `{ id, clause, description, domain, clarityRating }` rows.
Every subsequent phase references the same requirement IDs.

**T1.3 Coverage validator (gap + orphan detector)** — New validator that runs after every estimate
write: `SELECT tor_req WHERE NOT EXISTS (estimate_line WHERE torRef = tor_req.id)` for gaps,
and inverse for orphans. Fail the phase if either set is non-empty without an explicit justification
field on the line item.

**T1.4 Conf buffer formula validator** — Deterministic check: for each line item,
`lowHrs == hours` and `highHrs == round(hours * confBuffer[conf])`. Fail on mismatch.

### Tier 2 — Validate semantic structure

**T2.1 Assumption schema validator** — Regex + AI-backed check that each assumption has:
(a) TOR section citation OR customer Q&A reference, (b) "Impact if wrong:" clause with scope/effort
delta. Reject on missing pieces.

**T2.2 Risk Register schema validator** — Parse the Risk Register table; verify columns match
the CARL rule #15 schema. Fail on missing/empty `Open Question` or `Recommended Action`.

**T2.3 Integration tier validator** — For each integration in the estimate, verify Description
column contains a `T1|T2|T3` tag. For each integration in the proposal Section 4.2, verify tier
is stated. Cross-check integration sets match.

### Tier 3 — Strengthen weak prompts / safety nets

**T3.1 Rewrite Phase 4 prompt** — Expand from 2 sentences to a structured directive: "Re-read TOR
section X.Y. For each requirement, confirm the estimate addresses it. Produce a
requirement-by-requirement table with status {covered, partial, missing} and a remediation action."

**T3.2 Make `solution-architecture.md` mandatory** — Write it during Phase 1 (TOR Analysis) on
both paths, not just Phase 1A. Phase 5 proposal generation hard-fails if it is absent.

**T3.3 TOR-objective → proposal-section validator** — Parse proposal Section 2.2 Objectives and
verify each maps to a TOR requirement ID. Surface orphan objectives (in proposal but not TOR).

**T3.4 Surface NO_BENCHMARK counts** — Change `validate-estimate.ts` to report
`{passCount, warnCount, failCount, noBenchmarkCount}` with alerts when noBenchmarkCount > 10%
of total line items.

### Tier 4 — Reliability

**T4.1 Schema-retry on AI calls** — When a call returns malformed JSON or output shorter than a
minimum threshold, retry once with a stricter prompt ("Output MUST include keys X, Y, Z").
Log the retry. Never silently fall through.

**T4.2 Validator summary in engagement UI** — Surface a single "Accuracy Score" on the engagement
detail page: coverage %, orphan count, gap count, assumption compliance %, benchmark coverage %.
Makes drift visible at a glance, not buried in review artefacts.

## Acceptance Criteria for "alignment is enforced"

- [ ] Every estimate line item has a non-null `torRef` OR an explicit `orphanJustification` string.
- [ ] Every TOR requirement appears in at least one estimate line item OR in an explicit `deferredToPhase2` list.
- [ ] Every assumption has a TOR/Q&A citation and an `impactIfWrong` clause.
- [ ] Low/High hours match the Conf buffer formula to the integer.
- [ ] Every integration appears with a T1/T2/T3 tier in both estimate and proposal.
- [ ] Proposal objectives map 1:1 to TOR requirements (with surfaced mismatches).
- [ ] Phase 4 runs a re-read of the TOR and produces a structured coverage table.
- [ ] The engagement UI shows an "Accuracy Score" card with drill-down to specific gaps/orphans.

## What I'm deliberately NOT proposing

- Replacing AI generation with deterministic templating — the AI's domain reasoning is still valuable;
  validators should catch drift, not eliminate reasoning.
- Adding a full "agentic review loop" that re-runs the whole pipeline on every edit — too slow,
  breaks the iteration cadence. Catch drift at the validator layer instead.
- Rewriting validators in a different language / framework — current TypeScript modules are fine,
  just incomplete.

## Open Questions for the User

1. Is the HAS_RESPONSE path (Q&A → Phase 3 directly) currently writing a solution-architecture
   before estimate? If not, should Phase 1 always emit an initial draft?
2. How important is machine-queryable traceability (the `TorRequirement` + `LineItem` tables) vs.
   living with the markdown-only status quo? Tier 1 is significantly more effort, but pays dividends
   across every validator below it.
3. Is there a target "accuracy score" threshold you want to ship below (e.g., 95% coverage before
   auto-confirm)?

## Suggested Next Step

Pick Tier 1 (structured records + coverage validator + Conf formula check) as the first milestone —
it's the multiplier. Every Tier 2/3 check becomes straightforward once every requirement and line
item has a stable ID. Without Tier 1, further validators keep regex-guessing against markdown.
