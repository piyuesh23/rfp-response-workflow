/**
 * Smoke test for the scoped RAG store.
 *
 * Verifies the critical guardrail: when `scope=ENGAGEMENT` is used with a
 * specific engagementId, the SQL WHERE clause filters out every chunk from
 * other engagements — even if their embeddings are more semantically similar.
 *
 * Usage:
 *   cd tool && npx tsx scripts/test-rag-chat.ts
 *
 * Requires OPENAI_API_KEY and a running DB with the migration applied.
 */
import "dotenv/config";
import { randomBytes } from "crypto";

import { prisma } from "../src/lib/db";
import {
  indexStructuredRow,
  searchByText,
  similaritySearch,
} from "../src/lib/rag/store";
import { embed } from "../src/lib/rag/embedder";

if (process.env.RAG_MOCK_EMBEDDINGS === "1") {
  console.log(
    "[smoke] RAG_MOCK_EMBEDDINGS=1 — embedder will use deterministic mock vectors (no OpenAI call)"
  );
} else if (!process.env.OPENAI_API_KEY) {
  console.error(
    "[smoke] OPENAI_API_KEY is unset. Either export it or set RAG_MOCK_EMBEDDINGS=1 to run with mock vectors."
  );
  process.exit(1);
}

function uid(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

type Cleanup = () => Promise<void>;

async function run(): Promise<void> {
  console.log("[smoke] starting scope-filter smoke test");

  // Seed two throwaway accounts + engagements.
  const accountId = uid("acct");
  const engAId = uid("engA");
  const engBId = uid("engB");
  const testSourceIds: string[] = [];

  await prisma.account.create({
    data: {
      id: accountId,
      canonicalName: `RAG Smoke Test Account ${Date.now()}`,
    },
  });

  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user in DB; create one before running smoke test.");

  await prisma.engagement.create({
    data: {
      id: engAId,
      clientName: "Smoke Test A",
      projectName: "Project A",
      techStack: "DRUPAL",
      accountId,
      createdById: user.id,
    },
  });
  await prisma.engagement.create({
    data: {
      id: engBId,
      clientName: "Smoke Test B",
      projectName: "Project B",
      techStack: "DRUPAL",
      accountId,
      createdById: user.id,
    },
  });

  const cleanups: Cleanup[] = [];
  cleanups.push(async () => {
    await prisma.$executeRaw`DELETE FROM "EmbeddingChunk" WHERE "sourceId" = ANY(${testSourceIds}::text[])`;
    await prisma.engagement.deleteMany({ where: { id: { in: [engAId, engBId] } } });
    await prisma.account.delete({ where: { id: accountId } });
  });

  try {
    // Seed 3 chunks each for engagement A and B. Use clearly distinguishable
    // content so we can verify what comes back.
    const engAContents = [
      "Engagement A: the primary integration is Salesforce CRM with SSO.",
      "Engagement A: migration from Drupal 7 to Drupal 11 includes 2,400 nodes.",
      "Engagement A: frontend is Next.js 16 with a custom design system.",
    ];
    const engBContents = [
      "Engagement B: payments integration via Stripe and Braintree.",
      "Engagement B: headless WordPress multisite with 12 brand sites.",
      "Engagement B: React Native mobile app consuming the GraphQL gateway.",
    ];

    for (let i = 0; i < engAContents.length; i++) {
      const sid = uid(`srcA_${i}`);
      testSourceIds.push(sid);
      await indexStructuredRow({
        engagementId: engAId,
        sourceType: "SMOKE_TEST",
        sourceId: sid,
        summary: engAContents[i],
        metadata: { label: `A-${i}` },
      });
    }
    for (let i = 0; i < engBContents.length; i++) {
      const sid = uid(`srcB_${i}`);
      testSourceIds.push(sid);
      await indexStructuredRow({
        engagementId: engBId,
        sourceType: "SMOKE_TEST",
        sourceId: sid,
        summary: engBContents[i],
        metadata: { label: `B-${i}` },
      });
    }

    console.log("[smoke] seeded 6 chunks (3 per engagement)");

    // Case 1: scope=ENGAGEMENT with engAId — must return only A chunks.
    const q1 = "What integrations are in scope for this project?";
    const hitsA = await searchByText(q1, "ENGAGEMENT", engAId, 10);
    console.log(`[smoke] engagement-A query returned ${hitsA.length} hits`);
    const offScopeFromA = hitsA.filter((h) => h.engagementId !== engAId);
    if (offScopeFromA.length > 0) {
      throw new Error(
        `Scope leak! engagement A query returned ${offScopeFromA.length} non-A chunks: ${offScopeFromA
          .map((h) => `${h.id}(${h.engagementId})`)
          .join(", ")}`
      );
    }
    if (hitsA.length === 0) {
      throw new Error("Engagement A query returned zero hits — retrieval broken.");
    }
    console.log("[smoke] PASS: engagement-A scope filter only returned A chunks");

    // Case 2: scope=ENGAGEMENT with engBId — must return only B chunks.
    const q2 = "What mobile or commerce integrations are in scope?";
    const hitsB = await searchByText(q2, "ENGAGEMENT", engBId, 10);
    console.log(`[smoke] engagement-B query returned ${hitsB.length} hits`);
    const offScopeFromB = hitsB.filter((h) => h.engagementId !== engBId);
    if (offScopeFromB.length > 0) {
      throw new Error(
        `Scope leak! engagement B query returned ${offScopeFromB.length} non-B chunks.`
      );
    }
    if (hitsB.length === 0) {
      throw new Error("Engagement B query returned zero hits — retrieval broken.");
    }
    console.log("[smoke] PASS: engagement-B scope filter only returned B chunks");

    // Case 3: scope=ADMIN — must see chunks from both engagements.
    const vec = await embed(q1);
    const hitsAdmin = await similaritySearch({
      queryEmbedding: vec,
      scope: "ADMIN",
      topK: 20,
    });
    const smokeHits = hitsAdmin.filter((h) => h.sourceType === "SMOKE_TEST");
    const seenEngagements = new Set(smokeHits.map((h) => h.engagementId));
    console.log(
      `[smoke] admin query saw ${smokeHits.length} smoke-test chunks across engagements: ${Array.from(
        seenEngagements
      ).join(", ")}`
    );
    if (!seenEngagements.has(engAId) || !seenEngagements.has(engBId)) {
      throw new Error(
        "ADMIN scope did not return chunks from both engagements — filter too tight."
      );
    }
    console.log("[smoke] PASS: ADMIN scope saw chunks from both engagements");

    // Case 4: scope=ENGAGEMENT with missing engagementId — must throw.
    let threw = false;
    try {
      await similaritySearch({
        queryEmbedding: vec,
        scope: "ENGAGEMENT",
      });
    } catch (err) {
      threw = true;
      console.log(
        `[smoke] PASS: missing engagementId rejected — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    if (!threw) {
      throw new Error(
        "similaritySearch accepted scope=ENGAGEMENT without engagementId — guard broken."
      );
    }

    console.log("[smoke] ALL CHECKS PASSED");
  } finally {
    console.log("[smoke] cleaning up test data…");
    for (const fn of cleanups.reverse()) {
      try {
        await fn();
      } catch (err) {
        console.warn("[smoke] cleanup error:", err);
      }
    }
    await prisma.$disconnect();
  }
}

run().catch(async (err) => {
  console.error("[smoke] FAILED:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
