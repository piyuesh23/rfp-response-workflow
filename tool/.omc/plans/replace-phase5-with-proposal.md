# Plan: Replace Phase 5 (Knowledge Capture) with Technical Proposal Phase

## Requirements Summary
- Remove Phase 5 "Knowledge Capture" from the workflow
- Replace it with a "Technical Proposal" phase that generates a client-facing proposal document
- Available on BOTH workflow paths (NO_RESPONSE after 1A, HAS_RESPONSE after 3R)
- Uses existing `phase1a-proposal.ts` config as the base prompt (currently unused in the graph)
- Artefact type: PROPOSAL (already exists in the enum)

## Implementation Steps

### Step 1: Update phase-chain.ts — Replace Phase 5 definition
**File:** `tool/src/lib/phase-chain.ts`

- Change Phase 5 label from "Knowledge Capture" to "Technical Proposal"
- Keep the same dependency logic (follows 1A on NO_RESPONSE, follows 3R on HAS_RESPONSE)
- Keep `workflowPath: null` (available on both paths)

### Step 2: Rename and update the phase config
**File:** `tool/src/lib/ai/phases/phase5-capture.ts` → repurpose as phase5-proposal.ts

- Replace the Knowledge Capture prompt with the Technical Proposal prompt
- Reuse content from existing `phase1a-proposal.ts` but adapt for both paths:
  - On NO_RESPONSE path: proposal based on optimistic estimates + assumptions
  - On HAS_RESPONSE path: proposal based on confirmed estimates + customer responses
- Tools: `["Read", "Write"]` (same as before — reads all prior artefacts)
- Max turns: 40 (increased from 30 — proposals are longer)

### Step 3: Update phase config index
**File:** `tool/src/lib/ai/phases/index.ts`

- Map phase "5" to the new proposal config instead of capture config
- Remove the standalone `1A-proposal` mapping (no longer needed as separate entry)

### Step 4: Update phase-runner artefact type
**File:** `tool/src/workers/phase-runner.ts`

- Change `"5": ArtefactType.RESEARCH` to `"5": ArtefactType.PROPOSAL`

### Step 5: Update engagement overview UI label
**File:** `tool/src/app/engagements/[id]/page.tsx`

- The label comes from `getPhaseLabel()` in phase-chain.ts, so no UI change needed beyond Step 1

### Step 6: Update phase creation in engagement API
**File:** `tool/src/app/api/engagements/route.ts`

- Verify Phase 5 is still in the pre-created phase list (it should be — just the label changes)
- No change needed if phase numbers haven't changed

## Acceptance Criteria
- [ ] Phase 5 shows as "Technical Proposal" in the engagement timeline UI
- [ ] Phase 5 is runnable after Phase 1A completes (NO_RESPONSE path)
- [ ] Phase 5 is runnable after Phase 3R completes (HAS_RESPONSE path)
- [ ] Phase 5 produces a PROPOSAL artefact (not RESEARCH)
- [ ] Proposal tab (`/engagements/[id]/proposal`) displays the Phase 5 output
- [ ] The proposal content includes: Executive Summary, Technical Approach, Scope of Work, Timeline, Assumptions, Pricing Summary
- [ ] The old knowledge capture prompt is fully removed

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Existing Phase 5 artefacts (RESEARCH type) in DB become orphaned | Non-breaking — old artefacts stay readable, new ones use PROPOSAL type |
| Proposal page looks for PROPOSAL artefacts across all phases | Already implemented in our earlier rewrite — it searches all phases for artefactType === "PROPOSAL" |

## Verification Steps
1. `npx tsc --noEmit` passes
2. `docker compose build` succeeds
3. Create new engagement, run through NO_RESPONSE path → Phase 5 generates proposal
4. Proposal tab shows the generated content
5. Phase timeline shows "Technical Proposal" label for Phase 5
