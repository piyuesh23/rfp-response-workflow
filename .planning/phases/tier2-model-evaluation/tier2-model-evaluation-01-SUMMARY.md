---
phase: tier2-model-evaluation
plan: "01"
subsystem: ai-model-routing
tags: [model-migration, deprecation, cost-optimization, routing]
dependency_graph:
  requires: []
  provides: [current-model-ids, adaptive-thinking, haiku-routing, pricing-map]
  affects: [agent.ts, phase3r-critique.ts, phase5-capture.ts, phase-runner.ts, 7-sweep-files]
tech_stack:
  added: []
  patterns: [adaptive-thinking-opus-4-7, haiku-phase-routing, tiered-model-pricing]
key_files:
  created: []
  modified:
    - tool/src/lib/ai/agent.ts
    - tool/src/lib/ai/phase3r-critique.ts
    - tool/src/lib/ai/phases/phase5-capture.ts
    - tool/src/workers/phase-runner.ts
    - tool/src/app/api/engagements/infer/route.ts
    - tool/src/app/api/chat/route.ts
    - tool/src/lib/template-populator.ts
    - tool/src/lib/ai/extract-deliverables.ts
    - tool/src/lib/ai/gap-fix-patch.ts
    - tool/src/lib/ai/infer-engagement.ts
    - tool/src/workers/tech-stack-research.ts
decisions:
  - "Phase 5 routed to claude-haiku-4-5-20251001 instead of Opus — knowledge capture is low-complexity structured output, ~3x cheaper"
  - "Opus 4.7 adaptive thinking shape (no budget_tokens) — budget_tokens causes 400 error on claude-opus-4-7"
  - "Pricing map gains Haiku entry at $0.80/$4 per MTok (Anthropic May 2026 pricing)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-01"
  tasks_completed: 3
  files_modified: 11
---

# Phase tier2-model-evaluation Plan 01: Deprecated Model ID Migration Summary

**One-liner:** Migrated all claude-sonnet-4-20250514 and claude-opus-4-20250514 references to claude-sonnet-4-6 / claude-opus-4-7 / claude-haiku-4-5-20251001 across 11 files, updated Opus 4.7 adaptive thinking shape, routed Phase 5 to Haiku, and corrected pricing map keys before the June 15, 2026 hard deprecation.

## Changes Made

### Task 1 — agent.ts: model constants, getModelForPhase, buildThinkingParam
**Commit:** 5889c89

| Location | Before | After |
|---|---|---|
| line 44-45: DEFAULT_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| line 46: OPUS_MODEL | `"claude-opus-4-20250514"` | `"claude-opus-4-7"` |
| line 47 (new): HAIKU_MODEL | — | `"claude-haiku-4-5-20251001"` |
| line 52 (new): HAIKU_PHASES | — | `new Set(["5"])` |
| line 51-54: buildThinkingParam | `{type:"enabled", budget_tokens:8000}` | `{type:"adaptive"}` for Opus, `{}` otherwise |
| line 63-64 (new): HAIKU branch | — | `if (HAIKU_PHASES.has(String(config.phase))) return HAIKU_MODEL;` |

### Task 2 — phase3r-critique.ts, phase5-capture.ts, phase-runner.ts
**Commit:** 3b46e7d

| File | Location | Before | After |
|---|---|---|---|
| phase3r-critique.ts | line 108: aiJsonCall model | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| phase5-capture.ts | line 343: direct model override | `"claude-opus-4-20250514"` | `"claude-haiku-4-5-20251001"` |
| phase-runner.ts | lines 65-68: MODEL_PRICING keys | opus/sonnet 20250514 keys | claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5-20251001 |

### Task 3 — 7-file deprecated Sonnet sweep
**Commit:** 04fae42

| File | Variable | Before | After |
|---|---|---|---|
| tool/src/app/api/engagements/infer/route.ts | SONNET_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/app/api/chat/route.ts | CHAT_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/lib/template-populator.ts | inline (line 248) | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/lib/template-populator.ts | inline (line 449) | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/lib/ai/extract-deliverables.ts | SONNET_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/lib/ai/gap-fix-patch.ts | SONNET_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/lib/ai/infer-engagement.ts | SONNET_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |
| tool/src/workers/tech-stack-research.ts | SONNET_MODEL | `"claude-sonnet-4-20250514"` | `"claude-sonnet-4-6"` |

## Test Results

### npm run test:unit
```
Test Files  4 passed (4)
Tests  18 passed (18)
Start at  15:38:52
Duration  417ms
```
Status: PASSED

### npm run test:integration
```
Test Files  4 passed (4)
Tests  8 passed (8)
Start at  15:38:56
Duration  4.72s
```
Status: PASSED

## Deviations from Plan

None — plan executed exactly as written. The 7-file sweep list was accurate; no additional deprecated IDs were found beyond those specified.

Note: infer-engagement.ts (line 11) already had a HAIKU_MODEL constant set to "claude-haiku-4-5-20251001" — this was pre-existing and required no change.

## Self-Check: PASSED
