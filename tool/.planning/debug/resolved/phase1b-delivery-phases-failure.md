---
status: resolved
trigger: "Phase 1B: Delivery Phases Inference failed with retry option in UI"
created: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — stale Prisma client in Docker worker image
test: verified generated models directory in running container
expecting: DeliveryPhase.ts missing + DELIVERY_PHASES_INFERENCE absent in enums.ts
next_action: DONE — worker rebuilt and restarted

## Symptoms

expected: Phase 1B completes successfully, DeliveryPhase rows created in DB
actual: UI shows "Phase 1B: Delivery Phases Inference failed" with retry option
errors: Runtime error — ArtefactType.DELIVERY_PHASES_INFERENCE is undefined; prisma.deliveryPhase is undefined
reproduction: trigger Phase 1B job on any engagement
started: whenever DeliveryPhase schema additions were made after last Docker build

## Eliminated

- hypothesis: Zod schema mismatch between DeliveryPhaseInferenceSchema and AI response
  evidence: Schema and prompt are correctly aligned (phases[] with name/summary/scopeBullets/rationale/mappedTorSections)
  timestamp: 2026-04-28

- hypothesis: aiJsonCall import or signature mismatch
  evidence: aiJsonCall exists in ai-with-retry.ts with matching signature (model, system, user, schema, maxTokens, engagementId, phase)
  timestamp: 2026-04-28

- hypothesis: Missing TOR text causes AI to return bad output
  evidence: Phase 1B handles missing torText gracefully, also has torAssessment fallback
  timestamp: 2026-04-28

## Evidence

- timestamp: 2026-04-28
  checked: /app/src/generated/prisma/enums.ts inside tool-worker-1 container
  found: DELIVERY_PHASES_INFERENCE not present (grep returned 0 matches)
  implication: ArtefactType.DELIVERY_PHASES_INFERENCE evaluates to undefined at runtime

- timestamp: 2026-04-28
  checked: /app/src/generated/prisma/models/ inside tool-worker-1 container
  found: DeliveryPhase.ts model file completely absent
  implication: prisma.deliveryPhase throws "Cannot read properties of undefined" at runtime

- timestamp: 2026-04-28
  checked: local src/generated/prisma/enums.ts
  found: DELIVERY_PHASES_INFERENCE present with correct value
  implication: Schema was migrated and client was generated locally but Docker image was NOT rebuilt

## Resolution

root_cause: The worker Docker image (tool-worker) was built before DeliveryPhase model and DELIVERY_PHASES_INFERENCE ArtefactType enum were added to prisma/schema.prisma. The generated Prisma client baked into the image was stale — missing the DeliveryPhase model entirely and the DELIVERY_PHASES_INFERENCE enum value.
fix: Rebuilt worker image with `docker compose build worker` then restarted with `docker compose up -d worker`. Post-restart verification confirmed both DeliveryPhase.ts and DELIVERY_PHASES_INFERENCE are now present in the container.
verification: docker exec tool-worker-1 grep "DELIVERY_PHASES_INFERENCE" /app/src/generated/prisma/enums.ts → found. docker exec tool-worker-1 ls /app/src/generated/prisma/models/ | grep delivery → DeliveryPhase.ts present.
files_changed: []
