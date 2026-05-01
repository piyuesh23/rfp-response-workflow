/**
 * Programmatic CARL gates orchestrator.
 *
 * Runs all deterministic validators in parallel and classifies results into
 * blocking (auto-fix eligible) vs. warning-only violations. Callers use the
 * `blocking` array to decide whether to enqueue a gap-fix job rather than
 * inspecting each nested ValidatorResult individually.
 *
 * All five validators must pass (or at most WARN) for `overallStatus` to be
 * anything other than "FAIL". WARNs are surfaced but never block progression.
 */

import { runCoverageValidation } from "./coverage";
import { runConfFormulaValidation } from "./conf-formula";
import { runAssumptionValidation } from "./assumption";
import { runRiskRegisterValidation } from "./risk-register";
import { runIntegrationTierValidation } from "./integration-tier";
import type { ValidatorResult, ValidatorViolation } from "./types";

export interface CarlGatesReport {
  overallStatus: "PASS" | "WARN" | "FAIL";
  blocking: ValidatorViolation[];
  warnings: ValidatorViolation[];
  reports: {
    coverage: ValidatorResult;
    confFormula: ValidatorResult;
    assumption: ValidatorResult;
    riskRegister: ValidatorResult;
    integrationTier: ValidatorResult;
  };
}

export async function runCarlGates(
  engagementId: string,
  proposalMd?: string
): Promise<CarlGatesReport> {
  const [coverage, confFormula, assumption, riskRegister, integrationTier] =
    await Promise.all([
      runCoverageValidation(engagementId),
      runConfFormulaValidation(engagementId),
      runAssumptionValidation(engagementId),
      runRiskRegisterValidation(engagementId),
      runIntegrationTierValidation(engagementId, proposalMd),
    ]);

  const allResults = [coverage, confFormula, assumption, riskRegister, integrationTier];

  const blocking: ValidatorViolation[] = [];
  const warnings: ValidatorViolation[] = [];

  for (const result of allResults) {
    if (result.status === "FAIL") {
      blocking.push(...result.violations);
    } else if (result.status === "WARN") {
      warnings.push(...result.violations);
    }
  }

  const overallStatus: CarlGatesReport["overallStatus"] =
    blocking.length > 0 ? "FAIL" : warnings.length > 0 ? "WARN" : "PASS";

  return {
    overallStatus,
    blocking,
    warnings,
    reports: { coverage, confFormula, assumption, riskRegister, integrationTier },
  };
}
