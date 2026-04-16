# Plan — Accuracy & Alignment Implementation

**Parent review:** `accuracy-and-alignment-review.md`
**Goal:** Machine-enforce every CARL rule the prompts currently only suggest. Make TOR → Estimate → Proposal alignment observable in the DB and visible in the UI.

**User decisions captured:**
- Q1: `solution-architecture.md` on the HAS_RESPONSE path too → **yes, emit at Phase 1**
- Q2: Invest in `TorRequirement` + `LineItem` structured records → **yes, pay the cost once**
- Q3: Accuracy score threshold before auto-confirm → **yes, gate at a configurable threshold**

---

## Milestone Overview

| # | Name | Lines of work | Depends on | Ships independently? |
|---|------|---------------|------------|---------------------|
| M1 | Structured traceability foundation | schema + writers | — | yes, invisible to user |
| M2 | Coverage + Conf-formula validators | read M1 records | M1 | yes |
| M3 | Semantic validators (assumption, risk, integration tier) | read M1 | M1 | yes |
| M4 | Phase 4 rewrite + mandatory solution architecture + proposal→TOR | prompt + M1 | M1 | yes |
| M5 | Accuracy Score UI + confirm gating | aggregates M2-M4 | M2, M3 | yes |
| M6 | AI reliability (schema-retry + observability) | standalone | — | yes, parallelizable |

Ship M1 first. It's the multiplier — every later milestone becomes a straightforward DB query instead of regex-guessing markdown.

---

## M1 — Structured Traceability Foundation

### Schema changes (`prisma/schema.prisma`)

New models:

```prisma
model TorRequirement {
  id            String   @id @default(cuid())
  engagementId  String
  engagement    Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  clauseRef     String   // e.g. "3.2.1" or "Section 4.1"
  title         String   // short title
  description   String   @db.Text
  domain        String   // content_arch | integration | migration | frontend | devops | seo | a11y | perf | security
  clarityRating String   // CLEAR | NEEDS_CLARIFICATION | AMBIGUOUS | MISSING_DETAIL
  sourcePhaseId String?  // Phase 1 phase id
  createdAt     DateTime @default(now())

  lineItems     LineItem[]   @relation("LineItemToTorRequirement")
  assumptions   Assumption[] @relation("AssumptionToTorRequirement")

  @@index([engagementId])
}

model LineItem {
  id                   String   @id @default(cuid())
  engagementId         String
  engagement           Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  tab                  String   // BACKEND | FRONTEND | FIXED_COST | DESIGN | AI
  task                 String
  description          String   @db.Text
  hours                Float
  conf                 Int      // 1-6
  lowHrs               Float    // = hours
  highHrs              Float    // = hours * (1 + buffer[conf])
  benchmarkRef         String?
  integrationTier      String?  // T1 | T2 | T3 | null
  orphanJustification  String?  // required if no torRefs[]
  sourcePhaseId        String?
  createdAt            DateTime @default(now())

  torRefs              TorRequirement[] @relation("LineItemToTorRequirement")
  assumptionRefs       Assumption[]     @relation("AssumptionToLineItem")

  @@index([engagementId, tab])
}

model ValidationReport {
  id               String   @id @default(cuid())
  engagementId     String
  engagement       Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  phaseNumber      String   // "1", "1A", "3", "4", "5"
  ranAt            DateTime @default(now())
  overallStatus    String   // PASS | WARN | FAIL
  accuracyScore    Float    // 0..1
  gapCount         Int
  orphanCount      Int
  confFormulaViolations Int
  noBenchmarkCount Int
  details          Json     // full report body
}
```

Extensions to existing `Assumption` model:

```prisma
model Assumption {
  // … existing fields …
  torReference    String?  // already exists per earlier code
  impactIfWrong   String?  // add
  torRequirementRefs TorRequirement[] @relation("AssumptionToTorRequirement")
  lineItemRefs       LineItem[]       @relation("AssumptionToLineItem")
}
```

### Writers

**Phase 1 emits `TorRequirement` rows.** Update `src/lib/ai/phases/` Phase 1 prompt to also produce a JSON sidecar with the requirement list. Add a post-phase step in `src/workers/phase-runner.ts` that parses the sidecar and inserts `TorRequirement` rows. Use one AI call with schema-retry (see M6).

**Phase 1A + Phase 3 emit `LineItem` rows.** When the XLSX populator runs in `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts` (for imported estimates) and in the phase-runner Phase 1A/3 flow (for AI-generated estimates), also insert `LineItem` rows. Extraction logic already has `rawData: { backend, frontend, fixedCost, design, ai }`. Map that to `LineItem` records. Requires the AI prompt to also output `torRefs: string[]` and `integrationTier: "T1"|"T2"|"T3"|null` per line — update `solution-driven-estimates.md` and phase prompts accordingly.

**Link table population.** After both are written, run a reconciliation: for each `LineItem`, resolve its `torRefs` array (requirement IDs/clauses from AI output) to actual `TorRequirement.id`s.

### File touch list

- `prisma/schema.prisma` — add models
- `src/lib/ai/phases/phase1-tor.ts` (or equivalent) — add JSON sidecar output
- `src/lib/ai/phases/phase1a-estimate.ts` (or equivalent) — add JSON sidecar with torRefs/tier
- `src/lib/ai/phases/phase3-review.ts` — same
- `src/workers/phase-runner.ts` — parse sidecars, insert rows
- `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts` — insert LineItem rows from XLSX import

### Acceptance criteria

- [ ] Running Phase 1 creates N `TorRequirement` rows where N > 0 for any TOR with requirements.
- [ ] Running Phase 1A or 3 creates M `LineItem` rows where M equals the visible line count in the XLSX.
- [ ] Every `LineItem` either has ≥1 linked `TorRequirement` OR a non-null `orphanJustification`.
- [ ] Every `TorRequirement` can be queried for its linked `LineItem`s in a single SQL query.
- [ ] Backfill: existing confirmed engagements remain functional; no M1 structured data is required for viewing old engagements.

---

## M2 — Coverage + Conf-Formula Validators

### New validators (`src/lib/ai/validators/`)

Create `src/lib/ai/validators/coverage.ts`:

```ts
export async function runCoverageValidation(engagementId: string) {
  const requirements = await prisma.torRequirement.findMany({
    where: { engagementId },
    include: { lineItems: true },
  });
  const lineItems = await prisma.lineItem.findMany({
    where: { engagementId },
    include: { torRefs: true },
  });

  const gaps = requirements.filter((r) => r.lineItems.length === 0);
  const orphans = lineItems.filter(
    (li) => li.torRefs.length === 0 && !li.orphanJustification
  );

  return {
    gapCount: gaps.length,
    orphanCount: orphans.length,
    gaps: gaps.map((r) => ({ id: r.id, clauseRef: r.clauseRef, title: r.title })),
    orphans: orphans.map((li) => ({ id: li.id, tab: li.tab, task: li.task })),
  };
}
```

Create `src/lib/ai/validators/conf-formula.ts`:

```ts
const CONF_BUFFER: Record<number, number> = { 6: 0, 5: 0.25, 4: 0.5, 3: 0.5, 2: 0.75, 1: 1.0 };

export function validateConfFormula(lineItems: LineItem[]) {
  const violations: Array<{ id: string; task: string; expected: number; actual: number }> = [];
  for (const li of lineItems) {
    const expected = Math.round(li.hours * (1 + CONF_BUFFER[li.conf])) ;
    if (Math.abs(li.highHrs - expected) > 0.5) {
      violations.push({ id: li.id, task: li.task, expected, actual: li.highHrs });
    }
    if (Math.abs(li.lowHrs - li.hours) > 0.5) {
      violations.push({ id: li.id, task: li.task, expected: li.hours, actual: li.lowHrs });
    }
  }
  return { violations, count: violations.length };
}
```

### Hook into existing validator

Update `src/lib/ai/validate-estimate.ts` to call these and merge results into the validation report. Write a `ValidationReport` row per phase run.

### Acceptance criteria

- [ ] Seeded test engagement with a known 3-gap, 2-orphan estimate reports `gapCount: 3, orphanCount: 2`.
- [ ] A line item with `hours=10, conf=4` but `highHrs=12` is flagged (expected 15).
- [ ] The validator fails (WARN, not PASS) if `gapCount + orphanCount > 0`.
- [ ] The `ValidationReport` row is queryable and surfaced in the API response used by the engagement page.

---

## M3 — Semantic Validators

### `src/lib/ai/validators/assumption.ts`

Rules to enforce:
1. Assumption text contains a TOR reference (match `/§\s*\d+(\.\d+)*|Section\s*\d+|Clause\s*\d+|Q&A\s*#?\d+/i`) OR `torRequirementRefs.length > 0`.
2. Assumption text contains an "Impact if wrong" clause (match `/Impact\s*if\s*wrong[:\s]/i`) OR `impactIfWrong` field is populated.

Report both checks per assumption. Fail the report if >10% of assumptions miss either.

### `src/lib/ai/validators/risk-register.ts`

Parse the Risk Register from the generated markdown (existing extractor). Verify schema:
`Task | Tab | Conf | Risk/Dependency | Open Question for PM/Client | Recommended Action | Hours at Risk`.

For every `LineItem` where `conf <= 4`, confirm a Risk Register row exists with a matching task name. Also verify each risk row has non-empty `Open Question` and `Recommended Action` columns.

### `src/lib/ai/validators/integration-tier.ts`

Extract integrations from `TorRequirement` rows where `domain = "integration"`. For each, verify:
1. A `LineItem.integrationTier` is set (T1/T2/T3) and appears in Description column text.
2. The proposal artefact (`technical-proposal.md`) references the integration AND its tier in Section 4.2.

Fail if any integration lacks a tier or is missing from the proposal.

### File touch list

- `src/lib/ai/validators/assumption.ts` (new)
- `src/lib/ai/validators/risk-register.ts` (new)
- `src/lib/ai/validators/integration-tier.ts` (new)
- `src/lib/ai/validate-estimate.ts` — call new validators
- `src/lib/ai/validate-proposal.ts` — call integration-tier validator
- `src/lib/ai/metadata-extractor.ts` — ensure `impactIfWrong` is parsed out of assumption text

### Acceptance criteria

- [ ] An assumption missing "Impact if wrong:" is flagged.
- [ ] An assumption referencing `claude-artefacts/REQ-12` instead of a TOR section is flagged (existing rule, re-verified).
- [ ] A Risk Register row with empty "Recommended Action" is flagged.
- [ ] A `LineItem.integrationTier = "T2"` with Description lacking "T2" text is flagged.
- [ ] A proposal that omits an integration tier is flagged at `validate-proposal.ts`.

---

## M4 — Phase 4 Rewrite + Mandatory Architecture + Proposal→TOR

### Phase 4 prompt overhaul

Replace `getPhase4Prompt()` (in `src/lib/ai/phases/phase4-gap.ts` or wherever it lives) with a structured directive that forces:

1. Re-read the full TOR document (`tor/` files).
2. Produce a table: `| TOR Clause | Requirement | Estimate Line Items (IDs) | Coverage Status | Remediation |`
3. Coverage Status ∈ {`COVERED`, `PARTIAL`, `MISSING`, `DEFERRED`}.
4. For every `PARTIAL`/`MISSING`, a specific remediation action (add line item, revise existing, defer with rationale).
5. Also re-verify assumption carry-forward and risk register from Phase 3.

Add a schema sidecar output alongside the markdown so the writer step can update the DB (e.g., adding a `ValidationReport` row tagged phase 4).

### Mandatory `solution-architecture.md` at Phase 1

Move the solution-architecture drafting from Phase 1A to Phase 1. Both HAS_RESPONSE and NO_RESPONSE paths get a v0 architecture. Phase 1A/3 revise it. Phase 5 hard-fails (`throw`) if the file is missing.

File touch list: `src/lib/ai/phases/phase1-tor.ts`, `phase1a-estimate.ts`, `phase5-capture.ts`, `phase-runner.ts`.

### Proposal → TOR objective validator

In `src/lib/ai/validate-proposal.ts`, add:

1. Parse Section 2 (Understanding/Objectives) of the proposal.
2. For each parsed objective, attempt to link to a `TorRequirement` (by clauseRef or title similarity ≥ 0.75).
3. Report orphan objectives (in proposal, not in TOR) and missing objectives (in TOR, not in proposal).
4. Fail if missing objectives > 0.

### NO_BENCHMARK surfacing

Change `validate-estimate.ts` summary output to include `noBenchmarkCount`. Add alert when `noBenchmarkCount / totalLineItems > 0.10`.

### Acceptance criteria

- [ ] Phase 4 output includes a TOR-clause-by-clause coverage table.
- [ ] Phase 4 writes a `ValidationReport` row.
- [ ] Phase 5 throws a clear error if `solution-architecture.md` is missing.
- [ ] A proposal that omits a TOR objective fails `validate-proposal`.
- [ ] An estimate with 15% NO_BENCHMARK line items surfaces a warning.

---

## M5 — Accuracy Score UI + Confirm Gating

### Backend

Add `GET /api/engagements/[id]/accuracy` that returns the latest `ValidationReport` per phase and an aggregate score:

```ts
{
  overall: { score: 0.87, status: "WARN" },
  byPhase: {
    "1": { score: 0.95, status: "PASS", gapCount: 0, orphanCount: 0 },
    "1A": { score: 0.82, status: "WARN", gapCount: 2, orphanCount: 1, confFormulaViolations: 3 },
    "4": { score: 0.88, status: "WARN", ... },
    "5": { score: 0.91, status: "PASS", ... }
  }
}
```

Aggregation rule: `accuracyScore = weighted avg of phase scores; weights: {1: 0.2, 1A: 0.3, 3: 0.25, 4: 0.15, 5: 0.1}`.

### Frontend

Add `<AccuracyScoreCard>` to `src/app/engagements/[id]/page.tsx` sidebar (below EngagementStats). Shows:
- Overall score (progress bar with color tier: green ≥0.9, amber 0.75-0.9, red <0.75)
- Per-phase mini bars
- Click-through to a `/engagements/[id]/accuracy` detail page listing gaps, orphans, conf violations, etc.

### Confirm gating

Add a setting `AUTO_CONFIRM_MIN_ACCURACY_SCORE` (env var, default `0.85`). In `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts` (auto-confirm path), skip auto-confirm if the engagement's latest `ValidationReport` score < threshold — requires manual review.

### Acceptance criteria

- [ ] Engagement page shows an Accuracy Score card with the overall score.
- [ ] Drill-down page lists every gap, orphan, conf violation with a link back to the line item / requirement.
- [ ] Auto-confirm respects the threshold; a 0.72 engagement sits in PENDING_REVIEW instead of auto-confirming.

---

## M6 — AI Reliability (schema-retry + observability)

### Schema-retry wrapper

Create `src/lib/ai/ai-with-retry.ts`:

```ts
export async function aiJsonCall<T>({
  system,
  user,
  schema,
  maxRetries = 1,
}: { system: string; user: string; schema: JsonSchema; maxRetries?: number }): Promise<T> {
  // Call, validate against schema, retry once with "You MUST include keys X, Y, Z" if it fails.
  // Throw on second failure. Log both attempts.
}
```

Replace ad-hoc `JSON.parse(response.content[0].text)` patterns across `src/lib/ai/*` with `aiJsonCall`.

### Observability

Add a `aiCallLog` DB table (or structured logger writing to existing logs) capturing:
- `engagementId`, `phase`, `prompt_hash`, `input_tokens`, `output_tokens`, `duration_ms`, `retry_count`, `validation_outcome`.

Surface latest N failures on a small `/admin/ai-health` page.

### Acceptance criteria

- [ ] A mocked Claude response missing a required key triggers exactly one retry, then throws.
- [ ] The `aiCallLog` contains one row per phase call.
- [ ] `/admin/ai-health` shows the last 20 AI calls with outcome.

---

## Implementation Sequence

```
Week 1-2: M1 (foundation, invisible behind the scenes)
Week 3:   M2 (coverage + conf formula validators on top of M1)
Week 3-4: M3 (semantic validators, parallel to M2)
Week 4:   M4 (Phase 4 + proposal-TOR validator)
Week 5:   M5 (UI + confirm gating)
Week 5:   M6 (reliability — can run in parallel from Week 2 onward)
```

M1 is the gate. Do not start M2/M3/M4 until M1 writes rows on a real import.

## Parallel Workstreams

The six milestones are not strictly sequential — several subtasks have no dependency on M1 and
can be executed concurrently, shrinking wall-clock time significantly.

### Dependency graph

```
Wave 0 (no dependency — start all at once)
├── A. Prisma schema + migration      ── blocks everything below
├── B. M6 reliability wrapper         ── fully standalone
├── C. M4.a Phase 4 prompt rewrite    ── standalone (prompt-only)
└── D. M4.d NO_BENCHMARK surfacing    ── standalone (tweak to existing validator)

Wave 1 (after A merges)
├── A1. Phase 1 TOR sidecar writer        ── depends on schema
├── A2. Phase 1A/3 estimate sidecar       ── depends on schema; parallel to A1
└── A3. Confirm-route LineItem inserter   ── depends on schema; parallel to A1, A2

Wave 2 (after A1-A3 produce real rows)
├── G. M2.a coverage validator            ── independent
├── H. M2.b conf-formula validator        ── independent
├── I. M3.a assumption schema validator   ── independent
├── J. M3.b risk register validator       ── independent
├── K. M3.c integration tier validator    ── independent
├── L. M4.b solution-architecture move    ── depends on Phase 1 writer (A1)
└── M. M4.c proposal→TOR objective val.   ── depends on TorRequirement rows

Wave 3 (after M2 + M3 land)
├── N. M5 accuracy API endpoint
├── O. M5 AccuracyScoreCard component    ── can start w/ mocked API earlier
├── P. M5 drill-down page
└── Q. M5 confirm gating
```

### Workstream ownership suggestion

| Wave | Streams that can run concurrently | Notes |
|------|-----------------------------------|-------|
| 0 | **A + B + C + D** | 4 agents in parallel. A is the blocking one; B/C/D ship independently. |
| 1 | **A1 + A2 + A3** | 3 agents, each touching a different writer path. |
| 2 | **G + H + I + J + K + L + M** | Up to 7 agents. All new files under `src/lib/ai/validators/`. L needs A1 to be merged. |
| 3 | **N + O + P + Q** | UI can start against a mocked API to overlap with backend work. |

### Synchronisation points

1. **After Wave 0**: merge A (schema), run `prisma migrate deploy`. All Wave 1 work depends on this.
2. **After Wave 1**: run the Ferellgas import end-to-end; confirm TorRequirement and LineItem rows
   are populated. This is the gate to Wave 2.
3. **After Wave 2**: run validators against a seeded synthetic engagement (3 gaps, 2 orphans,
   known conf violations). Confirm all catch the seeded faults. This is the gate to Wave 3.

### Risks specific to parallel execution

- **Schema churn**: if A receives late feedback that changes column names, every Wave 1 writer
  must rebase. *Mitigation:* freeze the Prisma schema after A lands; defer any schema adjustments
  to a dedicated M1.5 milestone.
- **Prompt drift between A1 and A2**: Phase 1 (requirements) and Phase 1A/3 (estimates) must use
  compatible ID formats (e.g., `REQ-1.2.3` clauseRef) for the linker to resolve refs. *Mitigation:*
  define the ID convention in the schema PR (A) as a seed doc; every writer must follow it.
- **Validator double-counting**: if M2 and M3 both compute overlapping metrics they'll double-
  penalise accuracy score. *Mitigation:* every validator writes a single row into
  `ValidationReport.details` under a unique key; the aggregator (M5) knows the key list.

### Execution order for this session

I will start Wave 0 immediately with four concurrent agents:
- Agent A (me / main): Prisma schema + migration — critical path
- Agent B: M6 `aiJsonCall` wrapper + call log — standalone
- Agent C: Phase 4 prompt rewrite — standalone
- Agent D: NO_BENCHMARK surfacing in `validate-estimate.ts` — standalone

Wave 1 kicks off once Agent A lands the schema migration.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Prompt changes break AI output parsing | Ship M6 (schema-retry) in parallel so bad outputs fail loudly, not silently. |
| Existing engagements lack M1 records (null torRefs) | Backfill script reads the markdown matrices, best-effort populates the link table. Old engagements show accuracy score as "N/A" rather than failing. |
| Conf formula violations flood the report | The formula is deterministic; violations are real. Fix by tightening the XLSX populator, not relaxing the validator. |
| Phase 4 prompt rewrite regresses existing engagements | Feature-flag the new prompt; run the old one in parallel for 10 engagements and diff the outputs before cut-over. |
| `solution-architecture.md` mandatory break existing imports | Skip the check for `importedAt != null` engagements; only enforce on new AI-generated flows. |
| TorRequirement matching is fuzzy (clauseRef typos) | Store both `clauseRef` and `normalized_clause` (lowercased, whitespace-stripped); query on normalized. |

---

## Verification Plan

**End-to-end test engagement:** use the Ferellgas & Blue Rhino ZIP we just tested with, plus one synthetic TOR with 3 deliberate gaps and 2 orphans.

For each milestone:
1. Run the full Phase 0→5 pipeline on the test engagements.
2. Query the DB: every assertion in each milestone's "Acceptance criteria" must hold.
3. Open the engagement page: Accuracy Score reflects the known gaps/orphans (M5).
4. Tweak a line item's `highHrs` to break the formula; the validator catches it on next phase run (M2).

---

## Out of Scope (explicit)

- Replacing AI generation with rule-based templating.
- A full agentic replay loop on every edit.
- Translating validators to a different framework.
- Redesigning the engagement schema beyond the three new models.

---

## Next Step

Approve M1 scope and I'll start with the Prisma schema + migration, then the Phase 1 sidecar writer. The rest flows from there.
