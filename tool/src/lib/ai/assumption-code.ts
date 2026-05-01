const CATEGORY_PREFIX: Record<string, string> = {
  SCOPE: "SC",
  REGULATORY: "RG",
  INTEGRATION: "IN",
  MIGRATION: "MG",
  OPERATIONAL: "OP",
  PERFORMANCE: "PF",
};

export function createCodeGenerator(): (category: string) => string {
  const counts: Record<string, number> = {};
  return function nextCode(category: string): string {
    const prefix = CATEGORY_PREFIX[category] ?? "SC";
    counts[prefix] = (counts[prefix] ?? 0) + 1;
    return `A-${prefix}-${String(counts[prefix]).padStart(3, "0")}`;
  };
}
