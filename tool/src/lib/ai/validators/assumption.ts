/**
 * Assumption validator — M3.a.
 *
 * Enforces CARL rule 10 (assumption sourcing) and the "impact if wrong"
 * requirement at the DB layer instead of regex-scanning markdown.
 *
 * Rule A — TOR reference:
 *   (a) `torReference` populated, OR
 *   (b) `torRequirementRefs` non-empty, OR
 *   (c) text contains "§ 3.2", "Section 4", "Clause 2.1", "Q&A #7", "TOR §".
 *
 * Rule B — Impact if wrong:
 *   (a) `impactIfWrong` field populated (non-empty), OR
 *   (b) text contains "Impact if wrong: …".
 *
 * Grading:
 *   >25 % assumptions failing either rule → FAIL
 *   >10 %                                → WARN
 *   otherwise                            → PASS
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

const TOR_REFERENCE_RX =
  /§\s*\d+|Section\s*\d+|Clause\s*\d+|Q&A\s*#?\d+|TOR\s*[§\d]/i;

const IMPACT_RX = /Impact\s*if\s*wrong[:\s]/i;

const WARN_RATIO = 0.1;
const FAIL_RATIO = 0.25;

interface AssumptionDefect {
  id: string;
  missing: Array<"tor-reference" | "impact-if-wrong">;
}

export async function runAssumptionValidation(
  engagementId: string
): Promise<ValidatorResult> {
  const assumptions = await prisma.assumption.findMany({
    where: { engagementId, status: "ACTIVE" },
    select: {
      id: true,
      text: true,
      torReference: true,
      impactIfWrong: true,
      torRequirementRefs: { select: { id: true } },
    },
  });

  if (assumptions.length === 0) {
    return emptyPass("no active assumptions");
  }

  const defects: AssumptionDefect[] = [];

  for (const a of assumptions) {
    const missing: AssumptionDefect["missing"] = [];

    const hasTorRef =
      (a.torReference && a.torReference.trim().length > 0) ||
      a.torRequirementRefs.length > 0 ||
      TOR_REFERENCE_RX.test(a.text ?? "");
    if (!hasTorRef) missing.push("tor-reference");

    const hasImpact =
      (a.impactIfWrong && a.impactIfWrong.trim().length > 0) ||
      IMPACT_RX.test(a.text ?? "");
    if (!hasImpact) missing.push("impact-if-wrong");

    if (missing.length > 0) {
      defects.push({ id: a.id, missing });
    }
  }

  const defectRatio = defects.length / assumptions.length;
  const status: ValidatorResult["status"] =
    defects.length === 0
      ? "PASS"
      : defectRatio > FAIL_RATIO
        ? "FAIL"
        : defectRatio > WARN_RATIO
          ? "WARN"
          : "PASS";

  const violations: ValidatorResult["violations"] = [];
  if (defects.length > 0) {
    const missingTor = defects.filter((d) =>
      d.missing.includes("tor-reference")
    );
    const missingImpact = defects.filter((d) =>
      d.missing.includes("impact-if-wrong")
    );

    if (missingTor.length > 0) {
      violations.push({
        severity: status === "FAIL" ? "FAIL" : "WARN",
        message: `${missingTor.length}/${assumptions.length} assumption(s) lack a TOR/Q&A reference`,
        itemIds: missingTor.map((d) => d.id),
      });
    }
    if (missingImpact.length > 0) {
      violations.push({
        severity: status === "FAIL" ? "FAIL" : "WARN",
        message: `${missingImpact.length}/${assumptions.length} assumption(s) lack an "Impact if wrong" clause`,
        itemIds: missingImpact.map((d) => d.id),
      });
    }
  }

  return {
    status,
    details: {
      totalAssumptions: assumptions.length,
      defectCount: defects.length,
      defectRatio: Math.round(defectRatio * 1000) / 1000,
      defects: defects.slice(0, 50),
    },
    violations,
  };
}
