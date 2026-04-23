# Plan: Async RAG Indexing via BullMQ

## Problem

Vector DB (pgvector) indexing is synchronous inside phase/import workers and on
hot API routes. Every `await indexArtefact()` / `await indexStructuredRow()`
call passes through `aiLimiter` (3 concurrent, 2000ms min-delay) and OpenAI
`text-embedding-3-small`. Concretely this blocks:

- `src/workers/phase-runner.ts:379` — Phase 1 `indexTorSourceFiles()` (up to 40
  chunks × 2s throttle ≈ 80+ s before the phase even starts executing)
- `src/workers/phase-runner.ts:451,878,911,972` — artefact indexing after each
  phase completes
- `src/workers/phase-runner.ts:496,539,619,741` — per-row structured indexing
  (requirements, risks, assumptions, etc.)
- `src/app/api/engagements/route.ts:29` and `src/app/api/engagements/[id]/route.ts:28`
  — engagement create/update awaits indexing inline on an HTTP request
- `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts:411,502,747` — import
  confirm route indexes on the request thread

Phase job retries the entire phase on indexing failure today (attempts: 3 in
`src/lib/queue.ts:33`) even though artefact indexing errors are swallowed —
because TOR indexing in `safeIndexArtefact` is not the problem, but rate-limit
stalls inflate the overall phase wall-clock.

## Goal

Indexing must never block a phase, an import confirm, or an engagement
create/update. Indexing failures must not fail a phase. Indexing throughput
should improve by batching.

## Approach

Two independent changes that stack:

1. **New `rag-indexing` BullMQ queue + worker** — fire-and-forget at every
   call site. Retries, backoff, observability come from BullMQ.
2. **Batch embedding** — `indexArtefact` already passes `chunks` to
   `embedBatch` in one call (store.ts:167), so no change there. The real
   bottleneck is the per-artefact serialization through `aiLimiter` across
   many small artefacts / structured rows. The new queue with higher worker
   concurrency naturally parallelizes these; keep the aiLimiter as the global
   OpenAI throttle.

## Tasks

### 1. Queue plumbing — `src/lib/queue.ts`

Add a 4th queue analogous to the existing three:

```ts
export type RagIndexJobData =
  | {
      kind: "artefact";
      engagementId?: string;
      sourceType: string;
      sourceId: string;
      content: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "structured";
      engagementId?: string;
      sourceType: string;
      sourceId: string;
      summary: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "tor-files";
      engagementId: string;
      workDir: string;
    };

export function getRagIndexQueue(): Queue<RagIndexJobData> { ... }
```

Default options: `attempts: 3`, exponential backoff, `removeOnComplete: 200`,
`removeOnFail: 500`.

### 2. Worker — `src/workers/rag-index-worker.ts` (new)

- Import `indexArtefact`, `indexStructuredRow` from `@/lib/rag/store`.
- Import the TOR file reader/chunker from a shared location (see task 3).
- Dispatch on `job.data.kind`.
- Swallow only "empty content" no-ops; let real errors bubble so BullMQ retries.
- `concurrency: 4` (aiLimiter still caps OpenAI at 3 concurrent globally).

Register in the same entrypoint script that starts phase-runner /
import-worker / gap-fix-worker.

### 3. Extract `indexTorSourceFiles` into reusable module

Currently private inside phase-runner. Move to `src/lib/rag/tor-indexer.ts`
so the new worker can call it without importing phase-runner. Keep behavior
identical (cap at `TOR_MAX_CHARS`, skip non-PDF/DOCX, log per file).

### 4. Replace call sites with enqueues

Introduce a tiny helper `src/lib/rag/enqueue.ts`:

```ts
export async function enqueueIndexArtefact(params: IndexArtefactParams) { ... }
export async function enqueueIndexStructuredRow(params: IndexStructuredRowParams) { ... }
export async function enqueueIndexTorFiles(engagementId: string, workDir: string) { ... }
```

Each helper runs `getRagIndexQueue().add(...)` with `removeOnComplete`/`jobId`
(dedupe key: `${sourceType}:${sourceId}` so rapid re-indexes coalesce).

Swap call sites:

- `src/workers/phase-runner.ts:379` — `await indexTorSourceFiles(...)` → `await enqueueIndexTorFiles(...)`
- `src/workers/phase-runner.ts:29-79` — `safeIndexArtefact` / `safeIndexStructuredRow` become thin wrappers around the enqueue helpers (drop `aiLimiter.execute` here — the worker does the work)
- `src/app/api/engagements/route.ts:29` and `[id]/route.ts:28` — enqueue instead of await
- `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts:411, 502, 747` — enqueue instead of await

After enqueue, route handlers return immediately; no behavior change from the
client's perspective except faster responses.

### 5. Queue dedupe semantics

Use `jobId: \`${sourceType}:${sourceId}\`` for artefact/structured jobs so that
repeated re-indexes of the same source within a short window don't pile up.
BullMQ drops duplicate jobIds while a prior job is pending.

### 6. Backpressure / observability

- Log queue depth on a 30s timer in the worker (gated by `NODE_ENV !== "test"`).
- Add a minimal `/api/admin/rag-queue` GET returning `{ waiting, active, failed }`
  for ops visibility (optional, can defer).

### 7. Dev/test mode

`RAG_MOCK_EMBEDDINGS=1` still works — the worker calls the same store
functions. No change needed.

## Out of scope

- Changing the embedding model or chunk size.
- Reindexing historical artefacts.
- Moving similarity search out of the request thread (fast, no throttle).

## Verification

1. Kick a Phase 1 with ~3 TOR files. Confirm the phase completes without
   waiting on indexing (check `phase.completedAt` vs `AiCallLog` rows with
   `phase="RAG_INDEX"`; the latter should post-date the former).
2. Hit `POST /api/engagements` — response latency drops to DB-insert time.
3. Confirm an import item — response returns before `EmbeddingChunk` rows
   appear. Rows show up within a few seconds after.
4. Kill the rag worker mid-run: jobs stay in `waiting`, phase still completes,
   indexing resumes when worker restarts.
5. Verify chat / RAG retrieval still returns results for an engagement after
   a fresh Phase 1 run (with a short delay for the queue to drain).

## Rollback

Single env flag `RAG_INDEX_MODE=sync|async` gate in the enqueue helpers. If
set to `sync`, they fall through to direct `indexArtefact` / `indexStructuredRow`
calls. Default `async` after one stable day.

## Files touched

- `src/lib/queue.ts` — add queue
- `src/lib/rag/enqueue.ts` — new
- `src/lib/rag/tor-indexer.ts` — new (extracted)
- `src/workers/rag-index-worker.ts` — new
- `src/workers/phase-runner.ts` — swap calls, remove extracted function
- `src/app/api/engagements/route.ts` — swap call
- `src/app/api/engagements/[id]/route.ts` — swap call
- `src/app/api/imports/[id]/items/[itemId]/confirm/route.ts` — swap calls
- Worker entrypoint (wherever phase/import/gap-fix workers are started) — register rag worker

## Estimate

~4–6 hours including verification.
