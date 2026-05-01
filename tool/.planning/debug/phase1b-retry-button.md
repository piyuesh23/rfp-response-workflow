---
status: fixing
trigger: "Debug why the retry button for Phase 1B doesn't work in the RFP Copilot tool"
created: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Focus

hypothesis: Two compounding bugs — (1) UI hides the button when phases exist, (2) run endpoint rejects REVIEW status
test: Code confirmed by reading DeliveryPhasesPanel.tsx and run/route.ts
expecting: Fix to show Re-infer button always (when not confirmed) and allow REVIEW→re-run
next_action: Apply fix to DeliveryPhasesPanel.tsx and run/route.ts

## Symptoms

expected: Retry/Re-infer button available after a failed or completed Phase 1B run
actual: Button disappears once any DeliveryPhase rows exist; run endpoint returns 422 for REVIEW status
errors: 422 "Phase cannot run: status is REVIEW, expected PENDING or FAILED"
reproduction: Run Phase 1B once (creates DRAFT phases, sets phase status to REVIEW), then try to retry
started: Since Phase 1B was introduced

## Eliminated

- hypothesis: API URL bug (mentioned as already fixed in prompt)
  evidence: Trigger bug was pre-fixed
  timestamp: 2026-04-28

## Evidence

- timestamp: 2026-04-28
  checked: DeliveryPhasesPanel.tsx line 346
  found: Button gated on `phases.length === 0` — disappears once any phases exist
  implication: No retry possible from UI after first run

- timestamp: 2026-04-28
  checked: src/app/api/phases/[id]/run/route.ts line 36
  found: Only allows PENDING or FAILED; Phase 1B sets status to REVIEW on success
  implication: Even if button existed, re-run would get 422

- timestamp: 2026-04-28
  checked: phase1b-delivery-phases.ts lines 81-83
  found: Worker correctly deletes DRAFT phases before re-inserting — re-run logic is safe
  implication: Worker is fine; only UI and run endpoint need fixing

## Resolution

root_cause: |
  1. UI: Button hidden when phases.length > 0 — should show "Re-infer" when phases exist but not confirmed
  2. Run endpoint: Does not allow REVIEW status re-runs — must reset to PENDING before enqueue, or expand allowed statuses
fix: |
  - DeliveryPhasesPanel.tsx: Show "Infer Phases" button when phases.length === 0, show "Re-infer Phases" button when phases.length > 0 && !allConfirmed
  - run/route.ts: Add REVIEW to allowed statuses for re-run (reset to RUNNING directly)
verification: []
files_changed:
  - src/components/engagement/DeliveryPhasesPanel.tsx
  - src/app/api/phases/[id]/run/route.ts
