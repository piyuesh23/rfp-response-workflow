/**
 * OpenAI embedding wrapper for the RAG chatbot.
 *
 * Model: text-embedding-3-small (1536 dimensions) — matches the pgvector
 * column width defined on EmbeddingChunk.
 *
 * Every call is throttled through the shared `aiLimiter` and observability
 * rows are written to AiCallLog (phase="RAG_INDEX"). Retries with
 * exponential backoff on 429/5xx.
 */
import OpenAI from "openai";

import { aiLimiter } from "@/lib/ai/rate-limiter";
import { prisma } from "@/lib/db";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

let _client: OpenAI | null = null;

/**
 * Test-only deterministic mock. When RAG_MOCK_EMBEDDINGS=1 the embedder
 * returns a stable FNV-hashed vector so integration tests can exercise
 * the pgvector index without an OpenAI key. Production code MUST NOT rely
 * on this path.
 */
function mockEmbed(text: string): number[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const out = new Array<number>(EMBEDDING_DIMS);
  let x = h || 1;
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
  }
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBEDDING_DIMS; i++) out[i] /= norm;
  return out;
}

function isMockMode(): boolean {
  return process.env.RAG_MOCK_EMBEDDINGS === "1";
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to tool/.env.local (or your deployment secrets) " +
        "before running RAG indexing or chat. See https://platform.openai.com/api-keys."
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

async function logAiCall(params: {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  retryCount: number;
  outcome: "PASS" | "FAIL";
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        engagementId: null,
        phase: "RAG_INDEX",
        model: EMBEDDING_MODEL,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        durationMs: params.durationMs,
        retryCount: params.retryCount,
        validationOutcome: params.outcome,
        errorMessage: params.errorMessage?.slice(0, 1000) ?? null,
      },
    });
  } catch {
    // never let logging break the caller
  }
}

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("rate limit") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

async function callWithBackoff(
  inputs: string[],
  maxRetries = 3
): Promise<OpenAiEmbeddingResponse> {
  const client = getClient();
  const delays = [1_000, 3_000, 9_000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });
      return resp as unknown as OpenAiEmbeddingResponse;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.warn(
        `[rag/embedder] transient error (attempt ${attempt + 1}/${maxRetries}), backing off ${delay}ms: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Embed a single piece of text. Returns a 1536-dim float array.
 */
export async function embed(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

/**
 * Embed multiple pieces of text in a single API call. Returns one vector per input.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Short-circuit for tests; never runs when RAG_MOCK_EMBEDDINGS is unset.
  if (isMockMode()) {
    return texts.map((t) => mockEmbed(t && t.trim().length > 0 ? t : " "));
  }

  // OpenAI rejects empty strings; coerce to a single space so the index remains stable.
  const inputs = texts.map((t) => (t && t.trim().length > 0 ? t : " "));

  return aiLimiter.execute(async () => {
    const start = Date.now();
    let retryCount = 0;
    try {
      const resp = await callWithBackoff(inputs, 3);
      // Track rough retry count via the fact that we don't expose it here — leave 0.
      const vectors = resp.data.map((d) => d.embedding);
      if (vectors.length !== inputs.length) {
        throw new Error(
          `OpenAI returned ${vectors.length} vectors for ${inputs.length} inputs`
        );
      }
      for (const v of vectors) {
        if (v.length !== EMBEDDING_DIMS) {
          throw new Error(
            `OpenAI returned ${v.length}-dim vector; expected ${EMBEDDING_DIMS}`
          );
        }
      }
      await logAiCall({
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: 0,
        durationMs: Date.now() - start,
        retryCount,
        outcome: "PASS",
      });
      return vectors;
    } catch (err) {
      retryCount = 1;
      await logAiCall({
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - start,
        retryCount,
        outcome: "FAIL",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
}
