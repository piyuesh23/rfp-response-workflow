/**
 * Backfill script for the RAG chatbot embedding index.
 *
 * Walks every existing Engagement and indexes:
 *   - All PhaseArtefact contentMd (chunked) as ARTEFACT
 *   - All TorRequirement rows as REQUIREMENT
 *   - All LineItem rows as LINE_ITEM
 *   - All Assumption rows as ASSUMPTION
 *   - All RiskRegisterEntry rows as RISK
 *
 * Plus global (engagementId = null) indexing:
 *   - Every Engagement row as ENGAGEMENT_META
 *   - Every Benchmark row as BENCHMARK
 *
 * Idempotent: calls deleteChunksFor(sourceType, sourceId) before each index so
 * re-runs won't create duplicates.
 *
 * Run:   cd tool && npx tsx scripts/backfill-embeddings.ts
 *
 * Requires OPENAI_API_KEY in env at runtime (text-embedding-3-small).
 */
import { prisma } from "@/lib/db";
import { indexArtefact, indexStructuredRow, deleteChunksFor } from "@/lib/rag/store";

const MIN_CONTENT_LEN = 50;

let totalChunks = 0;
let lastReportedAt = 0;

function bump(chunkDelta = 1) {
  totalChunks += chunkDelta;
  if (totalChunks - lastReportedAt >= 100) {
    lastReportedAt = totalChunks;
    console.log(`[backfill] progress: ${totalChunks} chunks indexed so far`);
  }
}

async function safeIndexArtefactRow(params: {
  engagementId: string;
  sourceId: string;
  content: string | null;
  metadata: Record<string, unknown>;
}) {
  const content = params.content ?? "";
  if (content.trim().length < MIN_CONTENT_LEN) return;
  try {
    await deleteChunksFor("ARTEFACT", params.sourceId);
    await indexArtefact({
      engagementId: params.engagementId,
      sourceType: "ARTEFACT",
      sourceId: params.sourceId,
      content,
      metadata: params.metadata,
    });
    bump();
  } catch (err) {
    console.warn(
      `[backfill] artefact ${params.sourceId} failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

async function safeIndexStructured(params: {
  engagementId: string | null;
  sourceType: string;
  sourceId: string;
  summary: string;
  metadata: Record<string, unknown>;
}) {
  if (!params.summary || params.summary.trim().length < MIN_CONTENT_LEN) return;
  try {
    await deleteChunksFor(params.sourceType, params.sourceId);
    await indexStructuredRow({
      engagementId: params.engagementId ?? undefined,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      summary: params.summary,
      metadata: params.metadata,
    });
    bump();
  } catch (err) {
    console.warn(
      `[backfill] ${params.sourceType} ${params.sourceId} failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

async function backfillEngagement(engagementId: string): Promise<void> {
  // Artefacts (chunked).
  const artefacts = await prisma.phaseArtefact.findMany({
    where: { phase: { engagementId } },
    select: {
      id: true,
      artefactType: true,
      label: true,
      contentMd: true,
      phase: { select: { phaseNumber: true } },
    },
  });
  for (const a of artefacts) {
    await safeIndexArtefactRow({
      engagementId,
      sourceId: a.id,
      content: a.contentMd,
      metadata: {
        phaseNumber: a.phase.phaseNumber,
        artefactType: a.artefactType,
        label: a.label,
      },
    });
  }

  // TorRequirement rows.
  const reqs = await prisma.torRequirement.findMany({
    where: { engagementId },
    select: {
      id: true,
      clauseRef: true,
      title: true,
      description: true,
      domain: true,
      clarityRating: true,
    },
  });
  for (const r of reqs) {
    await safeIndexStructured({
      engagementId,
      sourceType: "REQUIREMENT",
      sourceId: r.id,
      summary: `${r.clauseRef}: ${r.title} — ${r.description} (${r.domain}, ${r.clarityRating})`,
      metadata: {
        clauseRef: r.clauseRef,
        domain: r.domain,
        clarityRating: r.clarityRating,
      },
    });
  }

  // LineItem rows.
  const lineItems = await prisma.lineItem.findMany({
    where: { engagementId },
    select: {
      id: true,
      tab: true,
      task: true,
      description: true,
      hours: true,
      conf: true,
      integrationTier: true,
      torRefs: { select: { clauseRef: true } },
    },
  });
  for (const li of lineItems) {
    const refs = li.torRefs.map((t) => t.clauseRef).join(",");
    await safeIndexStructured({
      engagementId,
      sourceType: "LINE_ITEM",
      sourceId: li.id,
      summary: `${li.tab}/${li.task}: ${li.description} (${li.hours}h, Conf ${li.conf}, TOR refs: ${refs})`,
      metadata: {
        tab: li.tab,
        hours: li.hours,
        conf: li.conf,
        integrationTier: li.integrationTier,
      },
    });
  }

  // Assumption rows.
  const assumptions = await prisma.assumption.findMany({
    where: { engagementId },
    select: {
      id: true,
      text: true,
      torReference: true,
      impactIfWrong: true,
      status: true,
    },
  });
  for (const a of assumptions) {
    await safeIndexStructured({
      engagementId,
      sourceType: "ASSUMPTION",
      sourceId: a.id,
      summary: `${a.text} | Impact: ${a.impactIfWrong}`,
      metadata: { torReference: a.torReference, status: a.status },
    });
  }

  // RiskRegisterEntry rows.
  const risks = await prisma.riskRegisterEntry.findMany({
    where: { engagementId },
    select: {
      id: true,
      task: true,
      tab: true,
      conf: true,
      risk: true,
      openQuestion: true,
      recommendedAction: true,
      hoursAtRisk: true,
    },
  });
  for (const r of risks) {
    await safeIndexStructured({
      engagementId,
      sourceType: "RISK",
      sourceId: r.id,
      summary: `${r.task} (${r.tab}, Conf ${r.conf}): ${r.risk}. Open Q: ${r.openQuestion}. Action: ${r.recommendedAction}`,
      metadata: { tab: r.tab, conf: r.conf, hoursAtRisk: r.hoursAtRisk },
    });
  }
}

async function backfillEngagementMetaGlobal(): Promise<void> {
  const engagements = await prisma.engagement.findMany({
    select: {
      id: true,
      clientName: true,
      projectName: true,
      techStack: true,
      engagementType: true,
      status: true,
      estimatedDealValue: true,
      rfpSource: true,
      outcome: true,
      accountId: true,
    },
  });
  for (const e of engagements) {
    const deal = e.estimatedDealValue != null ? `$${e.estimatedDealValue}` : "—";
    const rfp = e.rfpSource ?? "—";
    const outcome = e.outcome ?? "pending";
    const summary = `${e.clientName} / ${e.projectName ?? "—"} (${e.techStack}, ${e.engagementType}, ${e.status}). Deal: ${deal}. RFP source: ${rfp}. Outcome: ${outcome}.`;
    await safeIndexStructured({
      engagementId: null,
      sourceType: "ENGAGEMENT_META",
      sourceId: e.id,
      summary,
      metadata: {
        clientName: e.clientName,
        outcome: e.outcome,
        accountId: e.accountId,
      },
    });
  }
}

async function backfillBenchmarks(): Promise<void> {
  const benchmarks = await prisma.benchmark.findMany({
    where: { isActive: true },
    select: {
      id: true,
      techStack: true,
      category: true,
      taskType: true,
      lowHours: true,
      highHours: true,
    },
  });
  for (const b of benchmarks) {
    const summary = `${b.techStack}/${b.category}/${b.taskType}: ${b.lowHours}-${b.highHours}h`;
    await safeIndexStructured({
      engagementId: null,
      sourceType: "BENCHMARK",
      sourceId: b.id,
      summary,
      metadata: {
        techStack: b.techStack,
        category: b.category,
        taskType: b.taskType,
      },
    });
  }
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "[backfill] ERROR: OPENAI_API_KEY is not set. Export it (or add to tool/.env.local) before running."
    );
    process.exit(1);
  }

  console.log("[backfill] starting embedding backfill");

  const engagements = await prisma.engagement.findMany({ select: { id: true, clientName: true } });
  console.log(`[backfill] found ${engagements.length} engagement(s) to process`);

  for (const e of engagements) {
    console.log(`[backfill] engagement ${e.id} (${e.clientName}) — indexing...`);
    try {
      await backfillEngagement(e.id);
    } catch (err) {
      console.warn(
        `[backfill] engagement ${e.id} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log("[backfill] indexing ENGAGEMENT_META (global)...");
  await backfillEngagementMetaGlobal();

  console.log("[backfill] indexing BENCHMARK (global)...");
  await backfillBenchmarks();

  console.log(`[backfill] complete — ${totalChunks} chunks indexed total`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
