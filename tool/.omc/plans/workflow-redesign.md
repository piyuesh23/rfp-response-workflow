# Plan: Workflow Redesign — Non-Linear Phases, SSE Auto-Refresh, File Uploads

## Requirements Summary

### 1. Real-time UI updates (no polling)
- When a phase finishes (RUNNING → REVIEW), the overview page auto-updates via SSE
- ProgressStream component connects to real SSE endpoint
- Phase cards reflect status changes without manual refresh

### 2. Non-linear workflow with decision fork
**Current flow**: 0 → 1 → 1A → 2 → 3 → 4 → 5 (strictly sequential)

**New flow**:
```
TOR Upload → Create Engagement
       ↓
 ┌─────┴─────┐
 Phase 0      Phase 1         ← Can run in PARALLEL
 (Research)   (TOR Assessment)
 └─────┬─────┘
       ↓
   Decision Point (after both 0 + 1 approved)
       ↓
 ┌─────┴──────────────────────┐
 │ "No response" path          │ "Response received" path
 │                             │
 │ User clicks:                │ Phase 2: Upload Q&A response
 │ "Customer won't respond"    │         ↓
 │ + checkbox: generate        │ Estimate Phase: Upload estimate
 │   optimistic estimates      │         ↓
 │         ↓                   │ Review & Gap Analysis (combined)
 │ Phase 1A: Generate          │ → AI reviews estimate vs TOR+Q&A
 │   optimistic estimate       │ → Generates new estimate with gaps
 │   OR upload estimate sheet  │         ↓
 │         ↓                   │         │
 └─────┬──────────────────────┘         │
       ↓  ←←←←←←←←←←←←←←←←←←←←←←←←←←┘
   Phase 5: Knowledge Capture
   (Summary + HITL insights)
```

### 3. Phase 1A: skip or upload
- Allow skipping Phase 1A entirely
- Allow uploading an estimate sheet instead of AI-generating one
- CTA when "no response" path: "Generate Optimistic Estimates"

### 4. Phase 2: file upload
- Allow uploading customer Q&A response file(s)
- Files synced to MinIO under `engagements/{id}/responses_qna/`

### 5. Combined Review & Gap Analysis
- Merge Phase 3 (Review) and Phase 4 (Gap Analysis) into a single step
- AI reviews uploaded estimate against TOR + Q&A responses
- Produces gap analysis + revised estimate

### 6. Knowledge Capture with HITL
- Shows summary of the full engagement flow
- Surfaces generic insights that could improve any phase
- Human-in-the-loop: user confirms/edits insights before saving

---

## Acceptance Criteria

1. Overview page auto-updates when a phase transitions (RUNNING→REVIEW, RUNNING→FAILED) without manual refresh
2. Phase 0 and Phase 1 can both be started independently (no dependency between them)
3. After both Phase 0 and Phase 1 are APPROVED, a decision fork UI appears
4. "No response" path: shows "Customer won't respond" button with checkbox → triggers Phase 1A or allows estimate upload
5. "Response" path: Phase 2 shows file upload for Q&A responses → Estimate phase shows file upload → Combined Review+Gap runs
6. Phase 1A can be skipped via a "Skip" button
7. File uploads for Q&A responses (Phase 2) and estimate sheets (Phase 1A / Estimate phase) save to MinIO
8. Review & Gap Analysis is a single combined phase
9. Knowledge Capture shows engagement summary with editable insights
10. ProgressStream component connects to real `/api/phases/[id]/sse` endpoint

---

## Implementation Steps

### Step 1: SSE auto-refresh on overview page
**Files**: `src/app/engagements/[id]/page.tsx`, `src/components/phase/ProgressStream.tsx`

- Add an `EventSource` hook on the overview page that listens for phase completion
- When any phase transitions to REVIEW/APPROVED/FAILED, re-fetch engagement data
- Approach: Create a custom hook `usePhaseUpdates(engagementId)` that:
  - Finds any RUNNING phase from current state
  - Opens SSE connection to `/api/phases/{runningPhaseId}/sse`
  - On `done` or `error` event, calls `fetchEngagement()` to refresh
  - Cleans up EventSource on unmount or phase change
- Also wire ProgressStream to real SSE (replace MOCK_EVENTS)

### Step 2: Rewrite phase-chain.ts for non-linear dependencies
**File**: `src/lib/phase-chain.ts`

Replace the linear chain with a dependency graph:

```typescript
// New phase dependency model
interface PhaseDef {
  number: string;
  label: string;
  dependsOn: string[];        // ALL must be APPROVED/SKIPPED
  parallelWith?: string[];    // Can run alongside these
  optional: boolean;          // Can be skipped
  requiresDecision?: string;  // Requires a workflow decision before unlocking
}

const PHASES: PhaseDef[] = [
  { number: "0", label: "Research",           dependsOn: [],          optional: false },
  { number: "1", label: "TOR Assessment",     dependsOn: [],          parallelWith: ["0"], optional: false },
  { number: "1A", label: "Optimistic Estimate", dependsOn: ["0", "1"], optional: true, requiresDecision: "no-response" },
  { number: "2", label: "Responses",          dependsOn: ["0", "1"],  optional: true, requiresDecision: "has-response" },
  { number: "3", label: "Estimate Upload",    dependsOn: ["2"],       optional: false, requiresDecision: "has-response" },
  { number: "3R", label: "Review & Gap Analysis", dependsOn: ["3"],   optional: false, requiresDecision: "has-response" },
  { number: "5", label: "Knowledge Capture",  dependsOn: [],          optional: false }, // unlocks when either path completes
];
```

Key changes:
- Phase 0 and 1 have NO cross-dependency (can run in parallel)
- Phase 1A requires BOTH 0 and 1 approved + "no-response" decision
- Phase 2 requires BOTH 0 and 1 approved + "has-response" decision
- Remove old `canAutoStart` — nothing auto-starts except by explicit user action

### Step 3: Add workflow decision to Prisma schema
**File**: `prisma/schema.prisma`

Add a `workflowDecision` field to Engagement:

```prisma
model Engagement {
  // ... existing fields
  workflowPath  WorkflowPath?  // null = undecided, NO_RESPONSE, HAS_RESPONSE
}

enum WorkflowPath {
  NO_RESPONSE
  HAS_RESPONSE
}
```

### Step 4: Decision fork UI on overview page
**File**: `src/app/engagements/[id]/page.tsx`

After both Phase 0 and Phase 1 are APPROVED and no workflow decision made:
- Show a decision card with two paths:
  - **"Customer won't respond"** — sets `workflowPath = NO_RESPONSE`, unlocks Phase 1A
    - Checkbox: "Generate optimistic estimates automatically"
  - **"Customer responded"** — sets `workflowPath = HAS_RESPONSE`, unlocks Phase 2

API: `PATCH /api/engagements/{id}` already supports updates; add `workflowPath` to allowed fields.

### Step 5: Phase 1A — skip + upload support
**File**: `src/app/engagements/[id]/phases/[phase]/page.tsx`

When phase is "1A" and PENDING:
- Show two CTAs:
  - "Generate Optimistic Estimates" (runs AI phase as today)
  - "Upload Estimate Sheet" (file upload → saves to MinIO + creates PhaseArtefact)
  - "Skip Phase" (sets status to SKIPPED)

### Step 6: Phase 2 — file upload for Q&A responses
**File**: `src/app/engagements/[id]/phases/2/page.tsx` (already has QAResponseForm)

- Wire QAResponseForm to real upload API (`POST /api/upload`)
- Files saved to `engagements/{id}/responses_qna/` in MinIO
- After upload, trigger Phase 2 AI run (analyzes responses against TOR)

### Step 7: Estimate phase — upload support (response path)
**File**: new or extend existing phase page

On the "has-response" path after Phase 2:
- Show estimate upload UI
- Files saved to `engagements/{id}/estimates/` in MinIO
- Creates PhaseArtefact with the uploaded content

### Step 8: Combined Review & Gap Analysis
**Files**: `src/lib/phase-chain.ts`, phase config

- Merge Phase 3 (Review) and Phase 4 (Gap Analysis) into a single "3R" phase
- AI prompt: review uploaded estimate against TOR + Q&A responses → produce gap analysis + revised estimate
- Single PhaseArtefact with the combined output
- Update phase-chain dependencies

### Step 9: Knowledge Capture with HITL
**File**: Phase 5 detail page

- Show engagement summary (phases completed, artefacts generated, key metrics)
- AI generates generic insights
- User can edit/approve/reject each insight before saving
- Insights stored as structured data (not just markdown)

### Step 10: Update run API for parallel phases
**File**: `src/app/api/phases/[id]/run/route.ts`

- Replace linear dependency check with graph-based check
- Allow Phase 0 and Phase 1 to both be RUNNING simultaneously
- Check `workflowPath` for phases that require a decision

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| SSE connection leaks on navigation | `useEffect` cleanup closes EventSource |
| Parallel phases both writing to same dir | Each phase writes to distinct subdirs (research/ vs initial_questions/) |
| User changes workflow decision after starting a path | Disable decision change once a path-specific phase is RUNNING/REVIEW/APPROVED |
| Schema migration breaks existing data | Add `workflowPath` as nullable, existing engagements default to null (undecided) |
| Combined Review+Gap produces huge output | Bounded by maxTurns; split into sections in markdown |

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/phase-chain.ts` | rewrite | Graph-based dependency model |
| `prisma/schema.prisma` | modify | Add WorkflowPath enum + field |
| `src/app/engagements/[id]/page.tsx` | major | SSE hook, decision fork UI, parallel phase support |
| `src/app/engagements/[id]/phases/[phase]/page.tsx` | modify | Skip + upload for 1A, estimate upload |
| `src/app/engagements/[id]/phases/2/page.tsx` | modify | Wire real upload API |
| `src/components/phase/ProgressStream.tsx` | modify | Connect to real SSE endpoint |
| `src/app/api/phases/[id]/run/route.ts` | modify | Graph-based dependency check |
| `src/app/api/engagements/[id]/route.ts` | modify | Allow workflowPath in PATCH |
| `src/lib/ai/phases/phase3r-review-gaps.ts` | new | Combined review + gap analysis config |
| `src/lib/ai/prompts/phase-prompts.ts` | modify | Add combined review+gap prompt |

---

## Implementation Priority

1. **SSE auto-refresh** (Step 1) — Quick win, immediate UX improvement
2. **Phase chain rewrite** (Step 2) — Foundation for everything else
3. **Schema migration** (Step 3) — Required for decision fork
4. **Decision fork UI** (Step 4) — Core workflow change
5. **Phase 1A skip + upload** (Step 5) — Enables no-response path
6. **Phase 2 file upload** (Step 6) — Enables response path
7. **Estimate upload** (Step 7) — Completes response path
8. **Combined Review & Gap** (Step 8) — Merges phases
9. **Knowledge Capture HITL** (Step 9) — Final phase enhancement
10. **Run API update** (Step 10) — Enforces new dependency model
