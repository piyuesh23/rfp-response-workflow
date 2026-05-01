# Phase: tier2-model-override-ui - Research

**Researched:** 2026-05-01
**Domain:** Next.js API routes, Prisma schema, React UI, BullMQ phase-runner wiring
**Confidence:** HIGH

---

## Summary

This phase adds a per-engagement, per-phase model override capability. The entire vertical slice is well-scoped: one new nullable column on `Phase`, one new `PATCH` API sub-route, a small inline dropdown wired into `PhaseCard`, and two lines changed in `phase-runner.ts` to read the override from the DB record before calling `getPhaseConfig`. No new tables, no JSON blobs.

`PhaseConfig.model?: string` already exists in `agent.ts` and is already checked first by `getModelForPhase`. The only missing pieces are: a DB column to persist the choice, an API route to write it, and UI to surface it.

**Primary recommendation:** Column on `Phase` (`modelOverride String?`), PATCH sub-route at `/api/phases/[id]/model`, inline `<select>` in `PhaseCard` shown only for PENDING/FAILED/APPROVED phases, populated into `config.model` in `phase-runner.ts` immediately after the `getPhaseConfig` call.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Purpose |
|---------|---------|
| Prisma | Schema migration + DB access |
| Next.js App Router | API routes |
| React (client component) | Inline dropdown in PhaseCard |
| shadcn/ui `Select` | Consistent dropdown styling (already used in project) |
| BullMQ worker | phase-runner.ts consumes phase jobs |

### No new dependencies required.

---

## Architecture Patterns

### 1. Schema Change — Column on Phase (NOT JSON on Engagement)

**Decision: Add `modelOverride String?` to the `Phase` model.**

Current `Phase` model (schema.prisma lines 233-245):
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
  artefacts      PhaseArtefact[]

  @@unique([engagementId, phaseNumber])
}
```

Add one field:
```prisma
  modelOverride  String?         // null = use default; set to model ID to pin
```

**Why not JSON on Engagement:** A JSON blob on `Engagement` requires parsing, has no type safety, is harder to query, and couples multiple per-phase settings into one field. A nullable string on `Phase` is direct, type-safe, and queries trivially. Each `Phase` row is already per-engagement + per-phaseNumber (unique constraint), so the column is naturally scoped.

**Backfill:** No migration data script needed. Existing rows have `modelOverride = NULL`, which the phase-runner will treat as "use default" — no behaviour change.

**Migration command:**
```bash
cd tool && npx prisma migrate dev --name add_phase_model_override
```

---

### 2. API Route Design

**Route:** `PATCH /api/phases/[id]/model`

Create a new file: `tool/src/app/api/phases/[id]/model/route.ts`

Pattern mirrors existing sub-routes (`/run`, `/approve`, `/cancel`, `/reset`, `/skip`, `/revise`) — all are sub-directories under `[id]/`. This keeps the API structure consistent.

**Payload:**
```typescript
{ modelOverride: string | null }
// null clears the override (reverts to default)
// string must be one of the three valid model IDs or rejected 422
```

**Valid model IDs (from agent.ts lines 46-47):**
- `"claude-sonnet-4-6"` (default / Sonnet)
- `"claude-opus-4-7"` (Opus)
- `"claude-haiku-4-5-20251001"` (Haiku)
- `null` — clear override, revert to default

**Auth pattern:** Mirror `run/route.ts` — `requireAuth()` + `requireEngagementEdit()` guards.

**Response:** Return the updated phase: `{ id, phaseNumber, modelOverride }`.

**Validation:** Allowlist the three model IDs; reject unknown strings with 422.

---

### 3. Phase-Runner Wiring

**File:** `tool/src/workers/phase-runner.ts` lines 100-245

Current flow (lines 100-247):
1. Fetch `engagementData` from DB (line 100)
2. Call `getPhaseConfig(phaseNumber, techStack, engagementId, ...)` (line 234)
3. Call `applyPromptOverrides(config)` (line 247)

**Where to inject:** After step 2, before step 3. The `phaseId` is already in scope from `job.data`. Add a DB lookup of the phase's `modelOverride` and set `config.model` if non-null.

Minimal diff (conceptual):
```typescript
// After: let config = getPhaseConfig(...)
const phaseRecord = await prisma.phase.findUnique({
  where: { id: phaseId },
  select: { modelOverride: true },
});
if (phaseRecord?.modelOverride) {
  config = { ...config, model: phaseRecord.modelOverride };
}
// Then: config = await applyPromptOverrides(config)  ← unchanged
```

`getModelForPhase` in `agent.ts` line 68 already does `if (config.model) return config.model` — so setting `config.model` is the complete injection point. No changes needed in `agent.ts` or `getPhaseConfig`.

**Alternative (avoid extra query):** Pass `modelOverride` into the job data payload. Rejected — the override may be set after the job is enqueued, and reading from DB at run-time is more reliable. Also consistent with how `engagementData` is fetched at run-time rather than via job data.

---

### 4. UI Component Pattern

**Placement:** Inline in `PhaseCard.tsx` (client component, `tool/src/components/phase/PhaseCard.tsx`).

**Why PhaseCard, not a drawer:** PhaseCard is already the surface where per-phase actions live. An inline `<Select>` dropdown (shadcn/ui) keeps the override visible alongside phase status. A modal/drawer would hide it and require an extra click. Drawer is only warranted if there are many settings per phase — here there is one.

**Visibility rule:** Show the model selector only when phase is `PENDING`, `FAILED`, or `APPROVED` (re-run scenarios). Hide it when `RUNNING` (immutable during execution) or `SKIPPED`.

**PhaseCardData interface update:**
```typescript
export interface PhaseCardData {
  // ... existing fields ...
  modelOverride?: string | null   // current DB value
  phaseId?: string                // needed for PATCH call
  canEdit?: boolean               // derived from engagement edit permission
}
```

**Model display names** (for the dropdown):
| Model ID | Display Label |
|----------|---------------|
| `null` / `""` | Default (auto) |
| `"claude-sonnet-4-6"` | Sonnet 4.6 (balanced) |
| `"claude-opus-4-7"` | Opus 4.7 (high-quality) |
| `"claude-haiku-4-5-20251001"` | Haiku 4.5 (fast / cheap) |

**UX note:** Show a small badge alongside the phase status when an override is active (e.g., "Opus pinned"). This makes overrides discoverable at a glance.

---

### 5. Data Flow Summary

```
Operator sets dropdown in PhaseCard
  → PATCH /api/phases/[id]/model  { modelOverride: "claude-opus-4-7" }
  → prisma.phase.update({ modelOverride })
  → DB stores override on Phase row

Operator runs phase (POST /api/phases/[id]/run)
  → BullMQ job enqueued with phaseId
  → phase-runner picks up job
  → fetches phase.modelOverride from DB
  → sets config.model = modelOverride  (if non-null)
  → getModelForPhase sees config.model → returns override model
  → agent runs with pinned model
```

---

## Don't Hand-Roll

| Problem | Use Instead |
|---------|-------------|
| Dropdown styling | shadcn/ui `Select` component |
| Model allowlist validation | Server-side const array in route.ts |
| Auth/access guard | `requireAuth()` + `requireEngagementEdit()` (same as all other phase routes) |

---

## Common Pitfalls

### Pitfall 1: Setting config.model after applyPromptOverrides
**What goes wrong:** `applyPromptOverrides` may itself set `config.model` from a DB prompt override. If the DB `modelOverride` on Phase is applied after, it correctly wins. If applied before, a prompt override would clobber it.
**How to avoid:** Apply phase `modelOverride` AFTER `applyPromptOverrides` — or verify `applyPromptOverrides` does not touch `config.model` (check `lib/ai/phases/prompt-overrides.ts`). The safest sequence: `getPhaseConfig → applyPromptOverrides → apply modelOverride`. This gives the per-phase DB setting the highest precedence, below only an explicit `CLAUDE_MODEL` env var (which is global intent, not per-phase).

### Pitfall 2: Forgetting to include modelOverride in the phase data fetch on the engagement page
**What goes wrong:** The engagement page queries phases but doesn't select `modelOverride`, so the dropdown always shows "Default" even when an override is stored.
**How to avoid:** Update the engagement page (or API that feeds `PhaseCardData`) to `select: { modelOverride: true }` alongside other Phase fields.

### Pitfall 3: Allowing arbitrary model strings
**What goes wrong:** A bad actor or a UI bug sends an unknown model ID, causing Anthropic API errors mid-phase.
**How to avoid:** Server-side allowlist validation in the PATCH route. Return 422 for unknown model IDs.

### Pitfall 4: Test suite — schema.prisma change triggers required test runs
**Per CLAUDE.md:** Any change to `tool/prisma/schema.prisma` requires:
- `cd tool && npm run test:unit` — must pass
- `cd tool && npm run test:integration` — must pass
UI component changes require `npm run test:e2e`.

---

## Open Questions

1. **Does `applyPromptOverrides` touch `config.model`?**
   - Need to verify `tool/src/lib/ai/phases/prompt-overrides.ts` before finalising injection order.
   - Recommendation: Check during Wave 0. If it does, apply DB `modelOverride` last.

2. **Should VIEWER role be able to see the override selector (read-only)?**
   - Current access model: ADMIN/MANAGER can edit. VIEWER is read-only.
   - Recommendation: Show selector as disabled for VIEWER; show active badge regardless of role.

3. **Does the engagement page API already return phaseId per phase card, or only phaseNumber?**
   - The PATCH route needs the Phase `id` (CUID), not `phaseNumber`.
   - Verify what `PhaseCardData` currently receives; may need to add `phaseId` to the serialised shape.

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `tool/prisma/schema.prisma` lines 233-245 — Phase model, confirmed no modelOverride column
- `tool/src/lib/ai/agent.ts` lines 15-25, 44-52, 67-73 — PhaseConfig interface, model constants, getModelForPhase
- `tool/src/workers/phase-runner.ts` lines 82-247 — job handler, getPhaseConfig call site
- `tool/src/lib/ai/phases/index.ts` — getPhaseConfig signature (no model param)
- `tool/src/components/phase/PhaseCard.tsx` — existing PhaseCardData interface
- `tool/src/components/phase/PhaseTimeline.tsx` — how cards are rendered
- `tool/src/app/api/phases/[id]/run/route.ts` — auth + guard pattern to mirror

### Secondary (MEDIUM confidence)
- Sub-route directory listing confirms pattern: `approve/`, `cancel/`, `reset/`, `revise/`, `run/`, `skip/`, `sse/`, `validate/` — new `model/` fits cleanly.

---

## Metadata

**Confidence breakdown:**
- Schema change: HIGH — Phase model fully read; column addition is straightforward
- API design: HIGH — existing sub-route pattern is clear; no ambiguity
- UI placement: HIGH — PhaseCard is the only per-phase surface; PhaseTimeline renders cards
- Phase-runner wiring: HIGH — injection point is clear; getModelForPhase already does the right thing
- Pitfalls: HIGH — all derived from direct code reading

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (stable codebase; re-verify if prisma schema or agent.ts changes)
