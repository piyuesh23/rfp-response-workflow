/**
 * Shared types for the validators under `src/lib/ai/validators/*`.
 * Every validator function returns a uniform `ValidatorResult` so that the
 * calling orchestrator in `validate-estimate.ts` / `validate-proposal.ts` can
 * merge outputs into a single `ValidationReport` row without special cases.
 */

export type ValidatorStatus = "PASS" | "WARN" | "FAIL";

export interface ValidatorViolation {
  severity: "WARN" | "FAIL";
  message: string;
  itemIds?: string[];
}

export interface ValidatorResult {
  status: ValidatorStatus;
  details: Record<string, unknown>;
  violations: ValidatorViolation[];
}

export function emptyPass(note: string): ValidatorResult {
  return {
    status: "PASS",
    details: { note },
    violations: [],
  };
}
