---
phase: tier2-model-override-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tool/prisma/schema.prisma
  - tool/src/lib/model-overrides.ts
  - tool/src/app/api/phases/[id]/model/route.ts
  - tool/src/workers/phase-runner.ts
  - tool/src/components/phase/ModelOverrideSelect.tsx
  - tool/src/components/phase/PhaseCard.tsx
  - tool/src/app/engagements/[id]/page.tsx
autonomous: true
requirements:
  - tier2-model-override-ui-01
  - tier2-model-override-ui-02
  - tier2-model-override-ui-03
  - tier2-model-override-ui-04
  - tier2-model-override-ui-05

must_haves:
  truths:
    - "Phase card shows a model dropdown for phases in PENDING, FAILED, or APPROVED status"
    - "Selecting a model from the dropdown PATCHes /api/phases/[id]/model and the choice persists across page reload"
    - "When a phase runs, phase-runner reads modelOverride from DB and passes it as config.model"
    - "Selecting 'Default' in the dropdown sets modelOverride to null in DB"
    - "Unknown model strings are rejected by the API with 422"
    - "All unit, integration, and e2e test suites pass"
  artifacts:
    - path: "tool/prisma/schema.prisma"
      provides: "modelOverride String? field on Phase model"
      contains: "modelOverride"
    - path: "tool/src/lib/model-overrides.ts"
      provides: "ALLOWED_MODEL_OVERRIDES shared constant"
      exports: ["ALLOWED_MODEL_OVERRIDES", "ALLOWED_MODEL_VALUES"]
    - path: "tool/src/app/api/phases/[id]/model/route.ts"
      provides: "PATCH endpoint for model override"
      exports: ["PATCH"]
    - path: "tool/src/components/phase/ModelOverrideSelect.tsx"
      provides: "Dropdown UI component"
      exports: ["ModelOverrideSelect"]
  key_links:
    - from: "tool/src/components/phase/ModelOverrideSelect.tsx"
      to: "/api/phases/[id]/model"
      via: "fetch PATCH on select change"
      pattern: "fetch.*api/phases.*model"
    - from: "tool/src/workers/phase-runner.ts"
      to: "prisma.phase.findUnique"
      via: "DB read of modelOverride after applyPromptOverrides"
      pattern: "modelOverride"
    - from: "tool/src/app/engagements/[id]/page.tsx"
      to: "PhaseCardData"
      via: "phaseId and modelOverride fields added to phase mapping"
      pattern: "modelOverride"
---

<objective>
Deliver a complete per-engagement, per-phase model override feature: Prisma column, API
sub-route, phase-runner wiring, and UI dropdown inside PhaseCard.

Purpose: Operators can pin a specific Claude model (Sonnet 4.6 / Opus 4.7 / Haiku 4.5) to
any phase before running it. The override persists to DB and takes effect at run time.

Output:
- Migration: tool/prisma/migrations/*/migration.sql — adds modelOverride column
- Shared const: tool/src/lib/model-overrides.ts
- API: tool/src/app/api/phases/[id]/model/route.ts (PATCH)
- Worker: tool/src/workers/phase-runner.ts — reads override after applyPromptOverrides
- Component: tool/src/components/phase/ModelOverrideSelect.tsx
- Wired: PhaseCard.tsx accepts modelOverride + phaseId props; engagement page passes them
</objective>

<execution_context>
@/Users/piyuesh23/.claude/get-shit-done/workflows/execute-plan.md
@/Users/piyuesh23/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/tier2-model-override-ui/RESEARCH.md

<interfaces>
<!-- Phase model (schema.prisma lines 233-245) — add modelOverride after agentSessionId -->
```prisma
model Phase {
  id             String          @id @default(cuid())
  engagement     Engagement      @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  engagementId   String
  phaseNumber    String
  status         PhaseStatus     @default(PENDING)
  startedAt      DateTime?
  completedAt    DateTime?
  agentSessionId String?
  modelOverride  String?         // ADD THIS — null = use default
  artefacts      PhaseArtefact[]
  @@unique([engagementId, phaseNumber])
}
```

<!-- phase-runner.ts — injection point is lines 234-247 -->
```typescript
// line 234 — current
let config = getPhaseConfig(String(phaseNumber), techStack, engagementId, ...);
// line 247 — current
config = await applyPromptOverrides(config);
// INJECT AFTER line 247 — before revisionFeedback block:
const phaseRecord = await prisma.phase.findUnique({
  where: { id: phaseId },
  select: { modelOverride: true },
});
if (phaseRecord?.modelOverride) {
  config = { ...config, model: phaseRecord.modelOverride };
}
```

<!-- run/route.ts auth+guard pattern to mirror -->
```typescript
const session = await requireAuth();
const phase = await prisma.phase.findUnique({
  where: { id },
  include: { engagement: { select: { id: true, createdById: true } } },
});
if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });
await requireEngagementEdit(session, phase.engagement.id);
```

<!-- PhaseCardData interface — current (PhaseCard.tsx lines 25-36) -->
```typescript
export interface PhaseCardData {
  phaseNumber: string
  status: PhaseStatus
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  artefactCount?: number
  summary?: string
  locked?: boolean
  tokenCount?: number
  costUsd?: number
}
```

<!-- PhaseWithId — engagement page (page.tsx line 39-41) -->
```typescript
interface PhaseWithId extends PhaseCardData {
  id: string
}
```

<!-- Phase mapping in fetchEngagement (page.tsx lines 175-181) -->
```typescript
{
  phaseNumber: p.phaseNumber,
  status: p.status,
  startedAt: p.startedAt ?? null,
  completedAt: p.completedAt ?? null,
  artefactCount: p.artefacts?.length ?? 0,
  summary: extractPhaseSummary(p.phaseNumber, p.artefacts ?? []),
}
```

<!-- Engagement API GET (route.ts lines 54-65) — phases already included via include -->
<!-- modelOverride will automatically appear after schema migration -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema migration + shared constant + API route</name>
  <files>
    tool/prisma/schema.prisma,
    tool/src/lib/model-overrides.ts,
    tool/src/app/api/phases/[id]/model/route.ts
  </files>
  <behavior>
    - ALLOWED_MODEL_OVERRIDES contains exactly 3 entries: sonnet-4-6, opus-4-7, haiku-4-5
    - PATCH /api/phases/[id]/model with { modelOverride: "claude-opus-4-7" } returns 200 with updated phase
    - PATCH with { modelOverride: null } clears override and returns 200
    - PATCH with { modelOverride: "unknown-model" } returns 422
    - PATCH when phase not found returns 404
    - PATCH without auth returns 401
  </behavior>
  <action>
**Step A — schema.prisma:**
Add `modelOverride  String?` to the Phase model, immediately after `agentSessionId String?` and before `artefacts`. Then run:
```bash
cd tool && npx prisma migrate dev --name add_phase_model_override
```
Verify the migration file was created under `tool/prisma/migrations/`.

**Step B — tool/src/lib/model-overrides.ts (create new file):**
```typescript
export const ALLOWED_MODEL_OVERRIDES = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-opus-4-7", label: "Opus 4.7" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

export const ALLOWED_MODEL_VALUES = ALLOWED_MODEL_OVERRIDES.map((m) => m.value);
export type AllowedModelValue = (typeof ALLOWED_MODEL_OVERRIDES)[number]["value"];
```

**Step C — tool/src/app/api/phases/[id]/model/route.ts (create new file):**
Follow the exact auth pattern from `run/route.ts`:
1. `requireAuth()` → `requireEngagementEdit(session, phase.engagement.id)`
2. Parse JSON body: `{ modelOverride: string | null }`
3. If `modelOverride` is a non-null string AND not in `ALLOWED_MODEL_VALUES` → return 422 `{ error: "Invalid model" }`
4. `prisma.phase.update({ where: { id }, data: { modelOverride } })`
5. Return `{ id, phaseNumber, modelOverride }` with status 200

No status gate — the operator can update the model while the phase is PENDING, FAILED, or APPROVED.

**Step D — run tests (schema change mandatory):**
```bash
cd tool && npm run test:unit && npm run test:integration
```
Both must pass before this task is complete.
  </action>
  <verify>
    <automated>cd tool && npm run test:unit && npm run test:integration</automated>
  </verify>
  <done>
    Migration applied (prisma/migrations/*/add_phase_model_override exists). model-overrides.ts exports ALLOWED_MODEL_OVERRIDES and ALLOWED_MODEL_VALUES. PATCH /api/phases/[id]/model returns 200 for valid model IDs, 422 for unknown strings, 422 for non-null invalid strings, 200 with null to clear. Unit + integration test suites green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire phase-runner.ts to read modelOverride from DB</name>
  <files>
    tool/src/workers/phase-runner.ts
  </files>
  <action>
After line 247 (`config = await applyPromptOverrides(config);`) and BEFORE the `revisionFeedback` block (line 249), insert a DB read and conditional override:

```typescript
// Apply per-phase model override (highest precedence below global env var)
const phaseOverrideRecord = await prisma.phase.findUnique({
  where: { id: phaseId },
  select: { modelOverride: true },
});
if (phaseOverrideRecord?.modelOverride) {
  config = { ...config, model: phaseOverrideRecord.modelOverride };
}
```

**Why after applyPromptOverrides:** `applyPromptOverrides` may modify other config fields. Placing the DB override last ensures the per-phase model pin wins over any prompt-level default model. `getModelForPhase` in agent.ts checks `config.model` first (line 68: `if (config.model) return config.model`) — no further changes needed.

**Do NOT** add `modelOverride` to the BullMQ job data payload. Reading from DB at run-time is correct because the operator may set the override after the job is enqueued.

After editing, run:
```bash
cd tool && npm run test:unit && npm run test:integration
```
  </action>
  <verify>
    <automated>cd tool && npm run test:unit && npm run test:integration</automated>
  </verify>
  <done>
    phase-runner.ts reads phase.modelOverride from DB after applyPromptOverrides and sets config.model when non-null. Test suites remain green.
  </done>
</task>

<task type="auto">
  <name>Task 3: ModelOverrideSelect component + PhaseCard + engagement page wiring</name>
  <files>
    tool/src/components/phase/ModelOverrideSelect.tsx,
    tool/src/components/phase/PhaseCard.tsx,
    tool/src/app/engagements/[id]/page.tsx
  </files>
  <action>
**Step A — tool/src/components/phase/ModelOverrideSelect.tsx (create new file):**

"use client" component. Props:
```typescript
interface ModelOverrideSelectProps {
  phaseId: string
  currentOverride: string | null | undefined
  disabled?: boolean
  onUpdated?: (newOverride: string | null) => void
}
```

Use shadcn/ui `Select` (already in project). Options:
- Value `""` → label "Default (auto)"
- One entry per `ALLOWED_MODEL_OVERRIDES` entry

On value change: PATCH `/api/phases/${phaseId}/model` with `{ modelOverride: value === "" ? null : value }`. On success call `onUpdated(newOverride)`. Show a spinner while the fetch is in flight (use local `isPending` state). On error show a brief toast or console.error (do not crash).

Show an active badge next to the select when override is non-null: e.g. a small `<Badge variant="outline">Pinned</Badge>` inline.

**Step B — tool/src/components/phase/PhaseCard.tsx:**

1. Add two fields to `PhaseCardData`:
```typescript
modelOverride?: string | null
phaseId?: string
canEditModel?: boolean
```

2. Import and render `<ModelOverrideSelect>` inside the card, below the status badge line, only when:
   - `phaseId` is provided
   - `canEditModel` is true
   - `phase.status` is one of: `PENDING`, `FAILED`, `APPROVED`
   - NOT rendered when status is `RUNNING`, `REVIEW`, or `SKIPPED`

**Step C — tool/src/app/engagements/[id]/page.tsx:**

1. In `PhaseWithId` interface add: `modelOverride?: string | null` (already extends PhaseCardData which will now have it).

2. In the `fetchEngagement` phase mapping (lines 175-181), add two fields:
```typescript
modelOverride: p.modelOverride ?? null,
```
The `id` field is already on `PhaseWithId` and passed as-is. The engagement API GET already uses `include: { phases: { ... } }` — after the Prisma migration, `p.modelOverride` will be present automatically.

3. Where `PhaseTimeline` (and any other rendered phase list) passes props to PhaseCard, ensure `phaseId={p.id}` and `canEditModel={true}` (or derive from access.canEdit if `effectiveAccess` is available). The VIEWER-role guard is handled server-side; for now pass `canEditModel={true}` and let the API return 403 for viewers.

**Step D — run e2e tests:**
```bash
cd tool && npm run test:e2e
```
  </action>
  <verify>
    <automated>cd tool && npm run test:e2e</automated>
  </verify>
  <done>
    ModelOverrideSelect renders in PhaseCard for PENDING/FAILED/APPROVED phases. Selecting a model PATCHes /api/phases/[id]/model. PhaseCardData includes modelOverride and phaseId. The engagement page passes modelOverride from the API response into each phase card. E2e test suite green.
  </done>
</task>

</tasks>

<verification>
After all tasks complete, verify end-to-end:

1. Open an engagement with at least one PENDING phase.
2. The phase card shows the model dropdown defaulting to "Default (auto)".
3. Select "Opus 4.7" — the dropdown shows "Pinned" badge and no error toast.
4. Reload the page — dropdown still shows "Opus 4.7" (persisted to DB).
5. Run the phase — phase-runner picks up the override (confirm via logs: `config.model` equals `claude-opus-4-7`).
6. Select "Default (auto)" — badge disappears, modelOverride cleared to null in DB.
7. RUNNING phase — dropdown is not shown.

All automated suites:
```bash
cd tool && npm run test:unit && npm run test:integration && npm run test:e2e
```
All must pass.
</verification>

<success_criteria>
- `tool/prisma/migrations/*/add_phase_model_override/migration.sql` exists and applied
- `ALLOWED_MODEL_OVERRIDES` exported from `tool/src/lib/model-overrides.ts`
- PATCH `/api/phases/[id]/model` returns 200 for valid values, 422 for unknown strings
- `phase-runner.ts` reads `modelOverride` from DB after `applyPromptOverrides` and sets `config.model`
- `ModelOverrideSelect` renders inside PhaseCard for PENDING/FAILED/APPROVED statuses only
- `PhaseCardData` extended with `modelOverride`, `phaseId`, `canEditModel`
- Engagement page passes `modelOverride` from API response into each phase card
- `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` all green
</success_criteria>

<output>
After completion, create `.planning/phases/tier2-model-override-ui/tier2-model-override-ui-01-SUMMARY.md`
</output>
