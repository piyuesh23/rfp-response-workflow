export const PHASE_ORDER: string[] = ["0", "1", "1A", "2", "3", "4", "5"]

/**
 * Returns the next phase number in the chain, or null if currentPhaseNumber is the last.
 */
export function getNextPhase(currentPhaseNumber: string): string | null {
  const idx = PHASE_ORDER.indexOf(currentPhaseNumber)
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return null
  return PHASE_ORDER[idx + 1]
}

/**
 * Returns true for phases that auto-start immediately after the prior phase is approved.
 * Phase 0 -> 1: auto (TOR analysis kicks off after research is approved)
 * Phase 1 -> 1A: auto (optimistic estimation kicks off after TOR analysis is approved)
 * All others require a manual trigger.
 */
export function canAutoStart(phaseNumber: string): boolean {
  return phaseNumber === "1" || phaseNumber === "1A"
}

/**
 * Returns the phase number that must be APPROVED before this phase can start,
 * or null if this phase has no dependency (Phase 0 is always startable).
 */
export function getPhaseDependency(phaseNumber: string): string | null {
  const idx = PHASE_ORDER.indexOf(phaseNumber)
  if (idx <= 0) return null
  return PHASE_ORDER[idx - 1]
}
