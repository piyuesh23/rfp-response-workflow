/**
 * Format a USD cost value for display.
 * formatCost(1.5) → "$1.50"
 * formatCost(0.042) → "$0.04"
 */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/**
 * Format a token count for compact display.
 * formatTokens(52340) → "52k"
 * formatTokens(1234567) → "1.2M"
 * formatTokens(500) → "500"
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const k = count / 1_000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(count);
}
