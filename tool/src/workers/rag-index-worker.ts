/**
 * RAG indexing worker. Drains the `rag-indexing` BullMQ queue and performs
 * embedding + pgvector writes off the hot path of phase/import workers.
 *
 * Concurrency is set above 1 because the shared aiLimiter in
 * src/lib/ai/rate-limiter.ts is the real bottleneck on OpenAI calls —
 * letting multiple jobs race into the limiter utilises the global budget
 * without overwhelming the API.
 *
 * Run alongside phase-runner / import-worker / gap-fix-worker, e.g.
 *   npx tsx src/workers/rag-index-worker.ts
 */
import { Worker } from "bullmq";

import { getConnection, RagIndexJobData } from "@/lib/queue";
import { indexArtefact, indexStructuredRow } from "@/lib/rag/store";
import { indexTorSourceFiles } from "@/lib/rag/tor-indexer";

const worker = new Worker<RagIndexJobData>(
  "rag-indexing",
  async (job) => {
    const data = job.data;
    switch (data.kind) {
      case "artefact": {
        await indexArtefact({
          engagementId: data.engagementId ?? undefined,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          content: data.content,
          metadata: data.metadata,
        });
        return;
      }
      case "structured": {
        await indexStructuredRow({
          engagementId: data.engagementId ?? undefined,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          summary: data.summary,
          metadata: data.metadata,
        });
        return;
      }
      case "tor-files": {
        await indexTorSourceFiles(data.engagementId, data.workDir);
        return;
      }
      default: {
        const never: never = data;
        throw new Error(`Unknown rag-indexing job kind: ${JSON.stringify(never)}`);
      }
    }
  },
  {
    connection: getConnection(),
    concurrency: Math.max(1, parseInt(process.env.RAG_INDEX_CONCURRENCY ?? "4", 10) || 4),
  }
);

const concurrency = Math.max(1, parseInt(process.env.RAG_INDEX_CONCURRENCY ?? "4", 10) || 4);

worker.on("failed", (job, err) => {
  console.warn(
    `[rag-index-worker] job ${job?.id ?? "?"} failed: ${
      err instanceof Error ? err.message : String(err)
    }`
  );
});

worker.on("ready", () => {
  console.log(`[rag-index-worker] ready, concurrency=${concurrency}`);
});

async function shutdown(signal: string) {
  console.log(`[rag-index-worker] received ${signal}, closing…`);
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
