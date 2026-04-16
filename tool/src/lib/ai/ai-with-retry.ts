/**
 * Schema-validated Anthropic JSON call wrapper with single-retry and
 * observability logging to the AiCallLog table.
 *
 * Used by Milestone 6 (AI reliability) — wrap ad-hoc JSON.parse sites so
 * every AI call has: zod validation, retry-with-hint, and persisted metrics.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

import { prisma } from "@/lib/db";

export interface AiJsonCallOptions<T> {
  model: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens: number;
  /** Number of retries AFTER the first attempt. Defaults to 1 (so up to 2 total attempts). */
  maxRetries?: number;
  /** Optional engagement id for audit log. */
  engagementId?: string;
  /** Phase label for audit log (e.g. "IMPORT_INFERENCE"). */
  phase?: string;
}

type ValidationOutcome = "PASS" | "FAIL" | "RETRIED_OK";

interface AttemptResult<T> {
  ok: boolean;
  value?: T;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  missingKeys?: string[];
}

/**
 * Extract the first JSON object from a text blob.
 */
function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  return JSON.parse(match[0]);
}

/**
 * Best-effort extraction of missing/invalid key paths from a zod error.
 */
function missingKeysFromZod(err: unknown): string[] {
  if (
    err &&
    typeof err === "object" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown[] }).issues)
  ) {
    const issues = (err as { issues: Array<{ path?: Array<string | number> }> })
      .issues;
    return issues
      .map((i) => (Array.isArray(i.path) ? i.path.join(".") : ""))
      .filter(Boolean);
  }
  return [];
}

async function runOnce<T>(
  client: Anthropic,
  opts: AiJsonCallOptions<T>,
  userContent: string
): Promise<AttemptResult<T>> {
  let rawText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: userContent }],
  });

  inputTokens = response.usage?.input_tokens ?? 0;
  outputTokens = response.usage?.output_tokens ?? 0;
  rawText = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    const parsed = extractJson(rawText);
    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        rawText,
        inputTokens,
        outputTokens,
        error: result.error.message,
        missingKeys: missingKeysFromZod(result.error),
      };
    }
    return {
      ok: true,
      value: result.data,
      rawText,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    return {
      ok: false,
      rawText,
      inputTokens,
      outputTokens,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function logCall(params: {
  engagementId?: string;
  phase?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  retryCount: number;
  validationOutcome: ValidationOutcome;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        engagementId: params.engagementId ?? null,
        phase: params.phase ?? null,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        durationMs: params.durationMs,
        retryCount: params.retryCount,
        validationOutcome: params.validationOutcome,
        errorMessage: params.errorMessage ?? null,
      },
    });
  } catch {
    // Never let logging failure break the caller.
  }
}

/**
 * Call Anthropic, parse JSON, validate with zod, and retry once with a
 * "you must include these keys" hint on validation failure. Every attempt
 * is persisted to AiCallLog.
 */
export async function aiJsonCall<T>(opts: AiJsonCallOptions<T>): Promise<T> {
  const maxRetries = opts.maxRetries ?? 1;
  const client = new Anthropic();
  const start = Date.now();

  // Attempt 1
  let attempt = await runOnce(client, opts, opts.user);
  let totalInput = attempt.inputTokens;
  let totalOutput = attempt.outputTokens;

  if (attempt.ok) {
    await logCall({
      engagementId: opts.engagementId,
      phase: opts.phase,
      model: opts.model,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      durationMs: Date.now() - start,
      retryCount: 0,
      validationOutcome: "PASS",
    });
    return attempt.value as T;
  }

  // Retries
  let retriesUsed = 0;
  let lastError = attempt.error ?? "Unknown validation error";
  let lastMissing = attempt.missingKeys ?? [];

  while (retriesUsed < maxRetries) {
    retriesUsed += 1;
    const hint =
      lastMissing.length > 0
        ? `\n\nYou MUST include the following keys: ${lastMissing.join(", ")}`
        : `\n\nYour previous response failed JSON schema validation (${lastError}). Return valid JSON matching the schema exactly.`;
    const retryUser = opts.user + hint;

    attempt = await runOnce(client, opts, retryUser);
    totalInput += attempt.inputTokens;
    totalOutput += attempt.outputTokens;

    if (attempt.ok) {
      await logCall({
        engagementId: opts.engagementId,
        phase: opts.phase,
        model: opts.model,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        durationMs: Date.now() - start,
        retryCount: retriesUsed,
        validationOutcome: "RETRIED_OK",
      });
      return attempt.value as T;
    }

    lastError = attempt.error ?? lastError;
    lastMissing = attempt.missingKeys ?? [];
  }

  // All attempts failed
  await logCall({
    engagementId: opts.engagementId,
    phase: opts.phase,
    model: opts.model,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    durationMs: Date.now() - start,
    retryCount: retriesUsed,
    validationOutcome: "FAIL",
    errorMessage: lastError.slice(0, 1000),
  });
  throw new Error(`aiJsonCall failed after ${retriesUsed + 1} attempts: ${lastError}`);
}
