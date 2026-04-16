/**
 * Conf-formula validator — M2.b.
 *
 * Enforces CARL rule 14: for every line item,
 *   lowHrs  === hours
 *   highHrs === Math.round(hours * (1 + buffer[conf]))
 *
 * Buffer table (per the CARL rules):
 *   Conf 6 → +  0 %
 *   Conf 5 → + 25 %
 *   Conf 4 → + 50 %
 *   Conf 3 → + 50 %
 *   Conf 2 → + 75 %
 *   Conf 1 → +100 %
 *
 * A ±0.5 hr tolerance absorbs float rounding from the XLSX populator.
 *
 * Pure function — callers pass LineItem rows directly, no DB needed.
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

export const CONF_BUFFER: Record<number, number> = {
  6: 0,
  5: 0.25,
  4: 0.5,
  3: 0.5,
  2: 0.75,
  1: 1.0,
};

const TOLERANCE = 0.5;
const FAIL_RATIO = 0.05; // > 5 % → FAIL

export interface ConfLineItem {
  id: string;
  task: string;
  tab: string;
  hours: number;
  conf: number;
  lowHrs: number;
  highHrs: number;
}

interface ConfViolation {
  id: string;
  task: string;
  tab: string;
  field: "lowHrs" | "highHrs" | "conf";
  expected: number;
  actual: number;
}

export function validateConfFormula(lineItems: ConfLineItem[]): ValidatorResult {
  if (lineItems.length === 0) {
    return emptyPass("no line items");
  }

  const violations: ConfViolation[] = [];

  for (const li of lineItems) {
    const buffer = CONF_BUFFER[li.conf];
    if (buffer === undefined) {
      violations.push({
        id: li.id,
        task: li.task,
        tab: li.tab,
        field: "conf",
        expected: 0,
        actual: li.conf,
      });
      continue;
    }

    if (Math.abs(li.lowHrs - li.hours) > TOLERANCE) {
      violations.push({
        id: li.id,
        task: li.task,
        tab: li.tab,
        field: "lowHrs",
        expected: li.hours,
        actual: li.lowHrs,
      });
    }

    const expectedHigh = Math.round(li.hours * (1 + buffer));
    if (Math.abs(li.highHrs - expectedHigh) > TOLERANCE) {
      violations.push({
        id: li.id,
        task: li.task,
        tab: li.tab,
        field: "highHrs",
        expected: expectedHigh,
        actual: li.highHrs,
      });
    }
  }

  const violationRate = violations.length / lineItems.length;
  const status: ValidatorResult["status"] =
    violations.length === 0
      ? "PASS"
      : violationRate > FAIL_RATIO
        ? "FAIL"
        : "WARN";

  const resultViolations: ValidatorResult["violations"] = [];
  if (violations.length > 0) {
    resultViolations.push({
      severity: status === "FAIL" ? "FAIL" : "WARN",
      message: `${violations.length} line-item(s) violate the Conf buffer formula (${(violationRate * 100).toFixed(1)}%)`,
      itemIds: Array.from(new Set(violations.map((v) => v.id))),
    });
  }

  return {
    status,
    details: {
      totalLineItems: lineItems.length,
      violationCount: violations.length,
      violationRate: Math.round(violationRate * 1000) / 1000,
      violations: violations.slice(0, 50),
    },
    violations: resultViolations,
  };
}

/**
 * Convenience helper — loads all LineItems for an engagement and runs the
 * pure validator over them.  Returns PASS if there are no rows yet.
 */
export async function runConfFormulaValidation(
  engagementId: string
): Promise<ValidatorResult> {
  const rows = await prisma.lineItem.findMany({
    where: { engagementId },
    select: {
      id: true,
      task: true,
      tab: true,
      hours: true,
      conf: true,
      lowHrs: true,
      highHrs: true,
    },
  });

  if (rows.length === 0) {
    return emptyPass("no LineItem rows for this engagement");
  }

  return validateConfFormula(rows);
}
