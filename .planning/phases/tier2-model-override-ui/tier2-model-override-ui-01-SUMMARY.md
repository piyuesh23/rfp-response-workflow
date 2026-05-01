---
phase: tier2-model-override-ui
plan: "01"
subsystem: phase-runner, phase-api, phase-card-ui
tags: [model-override, prisma, nextjs-api, react-component, phase-runner]
dependency_graph:
  requires: []
  provides:
    - modelOverride column on Phase table
    - PATCH /api/phases/[id]/model endpoint
    - ModelOverrideSelect React component
    - per-phase model pinning in phase-runner
  affects:
    - tool/src/workers/phase-runner.ts
    - tool/src/components/phase/PhaseCard.tsx
    - tool/src/app/engagements/[id]/page.tsx
tech_stack:
  added:
    - tool/src/lib/model-overrides.ts (shared constant)
  patterns:
    - DB read at run-time for model override (not via job payload)
    - shadcn/ui Select with base-ui adapter
key_files:
  created:
    - tool/prisma/migrations/20260501_add_phase_model_override/migration.sql
    - tool/src/lib/model-overrides.ts
    - tool/src/app/api/phases/[id]/model/route.ts
    - tool/src/components/phase/ModelOverrideSelect.tsx
  modified:
    - tool/prisma/schema.prisma (modelOverride String? on Phase)
    - tool/src/workers/phase-runner.ts (DB read after applyPromptOverrides)
    - tool/src/components/phase/PhaseCard.tsx (new props + render)
    - tool/src/app/engagements/[id]/page.tsx (phase mapping + enrichment)
decisions:
  - "Used prisma.$executeRawUnsafe + IF NOT EXISTS for migration because DB schema was diverged from migration history (db push not viable)"
  - "Chose DB read at run-time in phase-runner (not job payload) so operator can change override after job is enqueued"
  - "modelOverride rendered in PhaseCard only for PENDING/FAILED/APPROVED — not RUNNING/REVIEW/SKIPPED"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-01"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 4
---

# Phase tier2-model-override-ui Plan 01: Model Override UI Summary

**One-liner:** Per-phase model pinning (Sonnet 4.6 / Opus 4.7 / Haiku 4.5) via Prisma column, PATCH API, phase-runner DB read, and ModelOverrideSelect dropdown in PhaseCard.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Schema migration + shared constant + API route | 90bf4f2 | migration.sql, model-overrides.ts, PATCH route |
| 2 | Wire phase-runner to read modelOverride from DB | 5588bcc | phase-runner.ts |
| 3 | ModelOverrideSelect + PhaseCard + engagement page wiring | 19baeef | ModelOverrideSelect.tsx, PhaseCard.tsx, page.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migrate dev blocked by schema drift**
- **Found during:** Task 1
- **Issue:** The DB had extra tables/enums (DeliveryPhase, estimationMode, DELIVERY_PHASES_INFERENCE ArtefactType variant) not in schema.prisma, causing `prisma migrate dev` and `prisma db push` to fail with data-loss errors.
- **Fix:** Created the migration directory and SQL file manually (`ALTER TABLE "Phase" ADD COLUMN IF NOT EXISTS "modelOverride" TEXT`), then applied via `prisma.$executeRawUnsafe` through tsx. Ran `prisma generate` to regenerate the client with the new field.
- **Files modified:** `prisma/migrations/20260501_add_phase_model_override/migration.sql` (created)
- **Commits:** 90bf4f2

### Pre-existing Failures (not caused by this plan)

**e2e test suite:** `ReferenceError: exports is not defined in ES module scope` in `e2e/global-setup.ts` — present before and after this plan's changes (verified via git stash). Documented as pre-existing; not fixed here.

## Self-Check: PASSED

- migration.sql: FOUND
- PATCH route: FOUND
- model-overrides.ts: FOUND
- ModelOverrideSelect.tsx: FOUND
- phase-runner wiring: FOUND
- All commits (90bf4f2, 5588bcc, 19baeef): FOUND
- npm run test:unit: 18/18 passed
- npm run test:integration: 8/8 passed
- npm run test:e2e: pre-existing failure (exports is not defined), unrelated to this plan
