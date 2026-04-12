/**
 * Token-bucket rate limiter for AI API calls.
 * Limits concurrency and enforces minimum delay between calls.
 * Retries on 429/529 (rate limit) errors with exponential backoff.
 */

export class AIRateLimiter {
  private queue: Array<{ resolve: (value: void) => void; reject: (error: Error) => void }> = [];
  private running = 0;
  private maxConcurrent: number;
  private minDelayMs: number;
  private lastCallTime = 0;

  constructor(maxConcurrent = 3, minDelayMs = 2000) {
    this.maxConcurrent = maxConcurrent;
    this.minDelayMs = minDelayMs;
  }

  private async acquireSlot(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  private releaseSlot(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next.resolve();
    }
  }

  private async enforceMinDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minDelayMs) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.minDelayMs - elapsed)
      );
    }
    this.lastCallTime = Date.now();
  }

  async execute<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    await this.acquireSlot();
    try {
      await this.enforceMinDelay();

      const backoffDelays = [5000, 15000, 45000];
      let lastError: Error = new Error("Unknown error");

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          const isRateLimit =
            error.message.includes("429") ||
            error.message.includes("529") ||
            error.message.includes("rate limit") ||
            error.message.includes("overloaded");

          if (isRateLimit && attempt < retries) {
            const delay = backoffDelays[attempt] ?? 45000;
            console.warn(
              `[rate-limiter] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`
            );
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      throw lastError;
    } finally {
      this.releaseSlot();
    }
  }
}

export const aiLimiter = new AIRateLimiter();
