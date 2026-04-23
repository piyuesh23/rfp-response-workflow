/**
 * Fire-and-forget helpers that push RAG indexing work onto a BullMQ queue
 * instead of blocking the caller on OpenAI embedding latency.
 *
 * A dedicated worker (src/workers/rag-index-worker.ts) drains the queue and
 * calls the same indexArtefact / indexStructuredRow / indexTorSourceFiles
 * functions as before. Retry + backoff come from BullMQ defaults.
 *
 * Set RAG_INDEX_MODE=sync to fall through to direct in-process calls —
 * useful for tests and as a rollback lever.
 */
import { getRagIndexQueue, RagIndexJobData } from "@/lib/queue";

import {
  indexArtefact,
  indexStructuredRow,
  IndexArtefactParams,
  IndexStructuredRowParams,
} from "./store";
import { indexTorSourceFiles } from "./tor-indexer";

const RAG_MIN_CONTENT_LEN = 50;

function isSyncMode(): boolean {
  return process.env.RAG_INDEX_MODE === "sync";
}

/**
 * Dedupe key keeps rapid re-indexes of the same source from stacking up.
 * BullMQ drops a new job if one with the same jobId is already pending.
 */
function jobId(sourceType: string, sourceId: string): string {
  return `rag:${sourceType}:${sourceId}`;
}

export async function enqueueIndexArtefact(
  params: IndexArtefactParams
): Promise<void> {
  const content = params.content ?? "";
  if (content.trim().length < RAG_MIN_CONTENT_LEN) return;

  if (isSyncMode()) {
    try {
      await indexArtefact(params);
    } catch (err) {
      console.warn(
        `[rag-index] (sync) Failed to index artefact ${params.sourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return;
  }

  try {
    const data: RagIndexJobData = {
      kind: "artefact",
      engagementId: params.engagementId ?? null,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      content,
      metadata: params.metadata,
    };
    await getRagIndexQueue().add("index-artefact", data, {
      jobId: jobId(params.sourceType, params.sourceId),
    });
  } catch (err) {
    console.warn(
      `[rag-index] Failed to enqueue artefact ${params.sourceId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function enqueueIndexStructuredRow(
  params: IndexStructuredRowParams
): Promise<void> {
  const summary = params.summary ?? "";
  if (summary.trim().length < RAG_MIN_CONTENT_LEN) return;

  if (isSyncMode()) {
    try {
      await indexStructuredRow(params);
    } catch (err) {
      console.warn(
        `[rag-index] (sync) Failed to index ${params.sourceType} ${params.sourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return;
  }

  try {
    const data: RagIndexJobData = {
      kind: "structured",
      engagementId: params.engagementId ?? null,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      summary,
      metadata: params.metadata,
    };
    await getRagIndexQueue().add("index-structured", data, {
      jobId: jobId(params.sourceType, params.sourceId),
    });
  } catch (err) {
    console.warn(
      `[rag-index] Failed to enqueue ${params.sourceType} ${params.sourceId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function enqueueIndexTorFiles(
  engagementId: string,
  workDir: string
): Promise<void> {
  if (isSyncMode()) {
    try {
      await indexTorSourceFiles(engagementId, workDir);
    } catch (err) {
      console.warn(
        `[rag-index] (sync) TOR source indexing failed for engagement ${engagementId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return;
  }

  try {
    const data: RagIndexJobData = {
      kind: "tor-files",
      engagementId,
      workDir,
    };
    await getRagIndexQueue().add("index-tor-files", data, {
      jobId: `rag:tor-files:${engagementId}`,
    });
  } catch (err) {
    console.warn(
      `[rag-index] Failed to enqueue TOR files for engagement ${engagementId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
