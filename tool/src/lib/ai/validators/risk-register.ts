/**
 * Risk-register validator — M3.b.
 *
 * For every LineItem with Conf ≤ 4 there must be a matching
 * RiskRegisterEntry (case-insensitive task match).  Each risk row must also
 * carry non-empty `openQuestion` AND `recommendedAction` text.
 *
 * Grading:
 *   FAIL — any Conf≤4 line item has no matching risk entry
 *   WARN — every Conf≤4 item is covered but some rows have blank fields
 *   PASS — full coverage, all fields populated
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

function normalize(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function overlapScore(a: string, b: string): number {
  const at = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const bt = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (at.size === 0 || bt.size === 0) return 0;
  let overlap = 0;
  for (const token of at) if (bt.has(token)) overlap += 1;
  return overlap / Math.min(at.size, bt.size);
}

function findMatch(
  lineTask: string,
  riskTasks: Map<string, { id: string; openQuestion: string; recommendedAction: string }>
): { id: string; openQuestion: string; recommendedAction: string } | null {
  const normalized = normalize(lineTask);
  const direct = riskTasks.get(normalized);
  if (direct) return direct;

  // Fuzzy fallback — token-overlap ≥ 0.6 is a match.
  for (const [riskTask, row] of riskTasks.entries()) {
    if (overlapScore(normalized, riskTask) >= 0.6) return row;
  }
  return null;
}

export async function runRiskRegisterValidation(
  engagementId: string
): Promise<ValidatorResult> {
  const [lineItems, risks] = await Promise.all([
    prisma.lineItem.findMany({
      where: { engagementId, conf: { lte: 4 } },
      select: { id: true, task: true, tab: true, conf: true },
    }),
    prisma.riskRegisterEntry.findMany({
      where: { engagementId },
      select: {
        id: true,
        task: true,
        openQuestion: true,
        recommendedAction: true,
      },
    }),
  ]);

  if (lineItems.length === 0) {
    return emptyPass("no Conf≤4 line items requiring risk entries");
  }

  const riskMap = new Map<
    string,
    { id: string; openQuestion: string; recommendedAction: string }
  >();
  for (const r of risks) {
    riskMap.set(normalize(r.task), {
      id: r.id,
      openQuestion: r.openQuestion ?? "",
      recommendedAction: r.recommendedAction ?? "",
    });
  }

  const missing: Array<{ id: string; task: string; conf: number }> = [];
  const blank: Array<{
    id: string;
    task: string;
    field: "openQuestion" | "recommendedAction";
  }> = [];

  for (const li of lineItems) {
    const match = findMatch(li.task, riskMap);
    if (!match) {
      missing.push({ id: li.id, task: li.task, conf: li.conf });
      continue;
    }
    if (!match.openQuestion.trim()) {
      blank.push({ id: match.id, task: li.task, field: "openQuestion" });
    }
    if (!match.recommendedAction.trim()) {
      blank.push({ id: match.id, task: li.task, field: "recommendedAction" });
    }
  }

  const violations: ValidatorResult["violations"] = [];
  if (missing.length > 0) {
    violations.push({
      severity: "FAIL",
      message: `${missing.length} Conf≤4 line item(s) missing from Risk Register`,
      itemIds: missing.map((m) => m.id),
    });
  }
  if (blank.length > 0) {
    violations.push({
      severity: "WARN",
      message: `${blank.length} Risk Register row(s) have blank openQuestion or recommendedAction`,
      itemIds: Array.from(new Set(blank.map((b) => b.id))),
    });
  }

  const status: ValidatorResult["status"] =
    missing.length > 0 ? "FAIL" : blank.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: {
      lowConfLineItems: lineItems.length,
      riskEntries: risks.length,
      missingCount: missing.length,
      blankFieldCount: blank.length,
      missing: missing.slice(0, 25),
      blank: blank.slice(0, 25),
    },
    violations,
  };
}
