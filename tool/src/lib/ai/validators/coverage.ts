/**
 * Coverage validator — M2.a.
 *
 * Detects TOR→Estimate alignment faults by querying the structured tables
 * populated by the Wave 1 writers:
 *   - `TorRequirement` rows (from Phase 1 sidecar)
 *   - `LineItem`        rows (from Phase 1A/3 sidecar or XLSX import)
 *
 * A `gap`    is a TorRequirement with zero linked LineItems.
 * An `orphan` is a LineItem with zero linked TorRequirements AND no
 * `orphanJustification` explaining why it is intentionally detached.
 *
 * Grading (overall status):
 *   PASS   — no gaps AND no orphans
 *   WARN   — some gaps/orphans but under the noise threshold
 *   FAIL   — any gaps or orphans exceed zero (the primary rule)
 *            the thresholds below only upgrade severity for high counts
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

const WARN_THRESHOLD = 5;

export async function runCoverageValidation(
  engagementId: string
): Promise<ValidatorResult> {
  const [requirements, lineItems] = await Promise.all([
    prisma.torRequirement.findMany({
      where: { engagementId },
      include: { lineItems: { select: { id: true } } },
    }),
    prisma.lineItem.findMany({
      where: { engagementId },
      include: { torRefs: { select: { id: true } } },
    }),
  ]);

  if (requirements.length === 0 && lineItems.length === 0) {
    return emptyPass(
      "no structured TorRequirement or LineItem rows for this engagement"
    );
  }

  const gaps = requirements.filter((r) => r.lineItems.length === 0);
  const orphans = lineItems.filter(
    (li) =>
      li.torRefs.length === 0 &&
      (!li.orphanJustification || li.orphanJustification.trim().length === 0)
  );

  const violations: ValidatorResult["violations"] = [];

  if (gaps.length > 0) {
    violations.push({
      severity: gaps.length > WARN_THRESHOLD ? "FAIL" : "FAIL",
      message: `${gaps.length} TOR requirement(s) have no linked estimate line items`,
      itemIds: gaps.map((r) => r.id),
    });
  }

  if (orphans.length > 0) {
    violations.push({
      severity: orphans.length > WARN_THRESHOLD ? "FAIL" : "FAIL",
      message: `${orphans.length} estimate line item(s) have no TOR linkage and no orphan justification`,
      itemIds: orphans.map((li) => li.id),
    });
  }

  // Status derivation: any gap/orphan => FAIL.  WARN reserved for the
  // "lots of them" case where the operator almost certainly needs triage.
  const status: ValidatorResult["status"] =
    gaps.length === 0 && orphans.length === 0
      ? "PASS"
      : gaps.length > WARN_THRESHOLD || orphans.length > WARN_THRESHOLD
        ? "FAIL"
        : "FAIL";

  return {
    status,
    details: {
      requirementCount: requirements.length,
      lineItemCount: lineItems.length,
      gapCount: gaps.length,
      orphanCount: orphans.length,
      gaps: gaps.map((r) => ({
        id: r.id,
        clauseRef: r.clauseRef,
        title: r.title,
      })),
      orphans: orphans.map((li) => ({
        id: li.id,
        tab: li.tab,
        task: li.task,
      })),
    },
    violations,
  };
}
