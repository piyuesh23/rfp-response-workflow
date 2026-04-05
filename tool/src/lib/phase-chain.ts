/**
 * Non-linear phase dependency graph.
 *
 * Phases 0 and 1 can run in parallel.
 * After both are approved, a workflow decision fork determines the path:
 *   - NO_RESPONSE: Phase 1A (optimistic estimate) → Phase 5 (technical proposal)
 *   - HAS_RESPONSE: Phase 2 (responses) → Phase 3 (estimate upload) → Phase 3R (review + gap) → Phase 5 (technical proposal)
 */

export type WorkflowPath = "NO_RESPONSE" | "HAS_RESPONSE" | null;

export interface PhaseDef {
  number: string;
  label: string;
  /** All listed phases must be APPROVED or SKIPPED before this phase can start */
  dependsOn: string[];
  /** This phase is only available on a specific workflow path (null = always available) */
  workflowPath: WorkflowPath;
  /** Can be skipped by the user */
  optional: boolean;
}

export const PHASE_DEFS: PhaseDef[] = [
  { number: "0",  label: "Research",              dependsOn: [],          workflowPath: null,           optional: false },
  { number: "1",  label: "TOR Assessment",        dependsOn: [],          workflowPath: null,           optional: false },
  { number: "1A", label: "Optimistic Estimate",   dependsOn: ["0", "1"],  workflowPath: "NO_RESPONSE",  optional: true },
  { number: "2",  label: "Responses",             dependsOn: ["0", "1"],  workflowPath: "HAS_RESPONSE", optional: false },
  { number: "3",  label: "Estimate Analysis",      dependsOn: ["2"],       workflowPath: "HAS_RESPONSE", optional: false },
  { number: "3R", label: "Review & Gap Analysis", dependsOn: ["3"],       workflowPath: "HAS_RESPONSE", optional: false },
  { number: "5",  label: "Technical Proposal",     dependsOn: [],          workflowPath: null,           optional: false },
];

/** Get phase definition by number */
export function getPhaseDef(phaseNumber: string): PhaseDef | undefined {
  return PHASE_DEFS.find((p) => p.number === phaseNumber);
}

/** Get the label for a phase number */
export function getPhaseLabel(phaseNumber: string): string {
  return getPhaseDef(phaseNumber)?.label ?? `Phase ${phaseNumber}`;
}

/**
 * Get all phases visible for a given workflow path.
 * All phases are always shown. Phases from the non-chosen path
 * are returned but will display as "Skipped" in the UI.
 */
export function getVisiblePhases(_workflowPath: WorkflowPath): PhaseDef[] {
  return PHASE_DEFS;
}

/**
 * Check if a phase is on the inactive workflow path (should show as skipped).
 * Returns true if a workflow path has been chosen and this phase belongs to the other path.
 */
export function isPhasePathSkipped(
  phaseNumber: string,
  workflowPath: WorkflowPath
): boolean {
  if (workflowPath === null) return false;
  const def = getPhaseDef(phaseNumber);
  if (!def || def.workflowPath === null) return false;
  return def.workflowPath !== workflowPath;
}

/**
 * Check if a phase can be started given the current state.
 *
 * @param phaseNumber - The phase to check
 * @param phaseStatuses - Map of phaseNumber → status
 * @param workflowPath - The chosen workflow path (null = undecided)
 */
export function canStartPhase(
  phaseNumber: string,
  phaseStatuses: Record<string, string>,
  workflowPath: WorkflowPath
): { canStart: boolean; reason?: string } {
  const def = getPhaseDef(phaseNumber);
  if (!def) return { canStart: false, reason: "Unknown phase" };

  // Check workflow path restriction
  if (def.workflowPath !== null && def.workflowPath !== workflowPath) {
    return {
      canStart: false,
      reason:
        workflowPath === null
          ? "Workflow decision not yet made"
          : `This phase is only available on the ${def.workflowPath} path`,
    };
  }

  // Phase 5 (Technical Proposal) has special logic: needs either path to complete
  if (phaseNumber === "5") {
    if (workflowPath === "NO_RESPONSE") {
      const phase1A = phaseStatuses["1A"];
      if (phase1A !== "APPROVED" && phase1A !== "SKIPPED") {
        return { canStart: false, reason: "Phase 1A must be completed first" };
      }
    } else if (workflowPath === "HAS_RESPONSE") {
      const phase3R = phaseStatuses["3R"];
      if (phase3R !== "APPROVED" && phase3R !== "SKIPPED") {
        return { canStart: false, reason: "Review & Gap Analysis must be completed first" };
      }
    } else {
      return { canStart: false, reason: "Workflow decision not yet made" };
    }
    return { canStart: true };
  }

  // Check all dependencies are APPROVED or SKIPPED
  for (const dep of def.dependsOn) {
    const depStatus = phaseStatuses[dep];
    if (depStatus !== "APPROVED" && depStatus !== "SKIPPED") {
      const depDef = getPhaseDef(dep);
      return {
        canStart: false,
        reason: `${depDef?.label ?? `Phase ${dep}`} must be approved first`,
      };
    }
  }

  return { canStart: true };
}

/**
 * Get the next phase(s) to act on after a phase is approved.
 * Returns an array since multiple phases may be unlockable.
 */
export function getNextPhases(
  approvedPhaseNumber: string,
  phaseStatuses: Record<string, string>,
  workflowPath: WorkflowPath
): string[] {
  const next: string[] = [];

  for (const def of PHASE_DEFS) {
    // Skip if already started
    const status = phaseStatuses[def.number];
    if (status && status !== "PENDING") continue;

    // Check if this phase can start now
    const { canStart } = canStartPhase(def.number, phaseStatuses, workflowPath);
    if (canStart) {
      next.push(def.number);
    }
  }

  return next;
}

/**
 * Check if the workflow decision fork should be shown.
 * Returns true when both Phase 0 and Phase 1 are approved and no decision has been made.
 */
export function shouldShowDecisionFork(
  phaseStatuses: Record<string, string>,
  workflowPath: WorkflowPath
): boolean {
  if (workflowPath !== null) return false;

  const phase0 = phaseStatuses["0"];
  const phase1 = phaseStatuses["1"];

  return (
    (phase0 === "APPROVED" || phase0 === "SKIPPED") &&
    (phase1 === "APPROVED" || phase1 === "SKIPPED")
  );
}
