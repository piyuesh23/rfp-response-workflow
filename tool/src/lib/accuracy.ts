/**
 * Accuracy scoring helpers.
 *
 * Phase weights mirror the Milestone 5 spec in
 * `.omc/plans/accuracy-alignment-implementation.md`.
 *
 * If a phase has no `ValidationReport` row yet, its weight is redistributed
 * proportionally across the phases that DO have reports, so the overall
 * score reflects only the evidence we actually have.
 */
import { prisma } from "@/lib/db";
import type { ValidationReport } from "@/generated/prisma/client";

export const PHASE_WEIGHTS: Record<string, number> = {
  "1": 0.2,
  "1A": 0.3,
  "3": 0.25,
  "4": 0.15,
  "5": 0.1,
};

export const TRACKED_PHASES = Object.keys(PHASE_WEIGHTS);

export type AccuracyStatus = "PASS" | "WARN" | "FAIL";

export function scoreToStatus(score: number): AccuracyStatus {
  if (score >= 0.9) return "PASS";
  if (score >= 0.75) return "WARN";
  return "FAIL";
}

/**
 * Returns the latest ValidationReport per tracked phase for the engagement,
 * keyed by phaseNumber. Phases with no report have a `null` value.
 */
export async function getLatestValidationReportsByPhase(
  engagementId: string
): Promise<Record<string, ValidationReport | null>> {
  const rows = await prisma.validationReport.findMany({
    where: { engagementId, phaseNumber: { in: TRACKED_PHASES } },
    orderBy: { ranAt: "desc" },
  });

  const out: Record<string, ValidationReport | null> = {};
  for (const phase of TRACKED_PHASES) out[phase] = null;

  // `orderBy ranAt desc` guarantees the first row we encounter per phase is latest.
  for (const row of rows) {
    if (out[row.phaseNumber] == null) {
      out[row.phaseNumber] = row;
    }
  }

  return out;
}

/**
 * Computes the weighted overall accuracy score across the provided reports.
 *
 * Weights for phases without a report are redistributed proportionally across
 * the phases that do have reports. Returns `null` if no reports exist at all.
 */
export function computeOverallAccuracy(
  reports: Record<string, ValidationReport | null>
): { score: number; status: AccuracyStatus } | null {
  const present = TRACKED_PHASES.filter((p) => reports[p] != null);
  if (present.length === 0) return null;

  const totalWeight = present.reduce((sum, p) => sum + PHASE_WEIGHTS[p], 0);
  if (totalWeight <= 0) return null;

  let weighted = 0;
  for (const p of present) {
    const report = reports[p]!;
    weighted += report.accuracyScore * (PHASE_WEIGHTS[p] / totalWeight);
  }

  // Clamp defensively — the DB column is 0..1 but we don't trust callers.
  const score = Math.max(0, Math.min(1, weighted));
  return { score, status: scoreToStatus(score) };
}

/**
 * Convenience: returns the overall accuracy for an engagement, or null
 * if no ValidationReport rows exist. Used by auto-confirm gating.
 */
export async function getOverallAccuracyForEngagement(
  engagementId: string
): Promise<{ score: number; status: AccuracyStatus } | null> {
  const reports = await getLatestValidationReportsByPhase(engagementId);
  return computeOverallAccuracy(reports);
}

/**
 * Reads the auto-confirm accuracy floor from the environment.
 * Defaults to 0.85 when unset or unparseable.
 */
export function getAutoConfirmMinAccuracyScore(): number {
  const raw = process.env.AUTO_CONFIRM_MIN_ACCURACY_SCORE;
  if (!raw) return 0.85;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return 0.85;
  return parsed;
}
