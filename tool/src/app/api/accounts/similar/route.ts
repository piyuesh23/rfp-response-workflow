import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const accounts = await prisma.account.findMany({
    orderBy: { canonicalName: "asc" },
    select: {
      id: true,
      canonicalName: true,
      industry: true,
      region: true,
      accountTier: true,
      _count: { select: { engagements: true } },
    },
  });

  const pairs: {
    accountA: (typeof accounts)[number];
    accountB: (typeof accounts)[number];
    matchType: "levenshtein" | "substring";
    distance?: number;
  }[] = [];

  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      const a = accounts[i];
      const b = accounts[j];
      const nameA = a.canonicalName.toLowerCase();
      const nameB = b.canonicalName.toLowerCase();

      // Case-insensitive substring match
      if (nameA.includes(nameB) || nameB.includes(nameA)) {
        pairs.push({ accountA: a, accountB: b, matchType: "substring" });
        continue;
      }

      // Levenshtein distance <= 3
      const dist = levenshtein(nameA, nameB);
      if (dist <= 3) {
        pairs.push({ accountA: a, accountB: b, matchType: "levenshtein", distance: dist });
      }
    }
  }

  return NextResponse.json(pairs);
}
