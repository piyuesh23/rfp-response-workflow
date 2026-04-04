"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { PhaseTimeline } from "@/components/phase/PhaseTimeline"
import type { PhaseCardData } from "@/components/phase/PhaseCard"
import { EngagementStats, type EngagementStatsData } from "@/components/engagement/EngagementStats"
import { RunPhaseButton } from "@/components/phase/RunPhaseButton"
import {
  ArrowRight, Loader2, CheckCircle2, Eye,
  GitFork, FileQuestion, FileSpreadsheet, SkipForward,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getVisiblePhases, shouldShowDecisionFork, canStartPhase, getPhaseLabel,
} from "@/lib/phase-chain"
import type { WorkflowPath } from "@/lib/phase-chain"

interface PhaseWithId extends PhaseCardData {
  id: string
}

interface EngagementData {
  id: string
  workflowPath: WorkflowPath
  phases: PhaseWithId[]
}

const EMPTY_STATS: EngagementStatsData = {
  totalHours: { low: 0, high: 0 },
  hoursByTab: {
    backend: { low: 0, high: 0 },
    frontend: { low: 0, high: 0 },
    fixedCost: { low: 0, high: 0 },
    ai: { low: 0, high: 0 },
  },
  requirementCount: 0,
  clarityBreakdown: { clear: 0, needsClarification: 0, ambiguous: 0, missingDetail: 0 },
  confidenceDistribution: { high56: 0, medium4: 0, low123: 0 },
  riskCount: { total: 0, high: 0, medium: 0, low: 0 },
  assumptionCount: { total: 0, resolved: 0, open: 0 },
}

export default function EngagementOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [engagement, setEngagement] = React.useState<EngagementData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

  const fetchEngagement = React.useCallback(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setEngagement({
            id: data.id,
            workflowPath: data.workflowPath ?? null,
            phases: (data.phases ?? []).map(
              (p: { id: string; phaseNumber: string; status: string; startedAt?: string; completedAt?: string; artefacts?: unknown[] }) => ({
                id: p.id,
                phaseNumber: p.phaseNumber,
                status: p.status,
                startedAt: p.startedAt ?? null,
                completedAt: p.completedAt ?? null,
                artefactCount: p.artefacts?.length ?? 0,
              })
            ),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => {
    fetchEngagement()
  }, [fetchEngagement])

  // SSE auto-refresh for running phases
  React.useEffect(() => {
    if (!engagement) return
    const runningPhase = engagement.phases.find((p) => p.status === "RUNNING")
    if (!runningPhase) return

    const eventSource = new EventSource(`/api/phases/${runningPhase.id}/sse`)
    const refresh = () => { eventSource.close(); fetchEngagement() }

    eventSource.addEventListener("done", refresh)
    eventSource.addEventListener("error", refresh)

    return () => { eventSource.close() }
  }, [engagement, fetchEngagement])

  async function handleRunPhase(phaseId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/phases/${phaseId}/run`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        console.error("Failed to run phase:", err.error)
        return
      }
      fetchEngagement()
    } catch (err) {
      console.error("Failed to run phase:", err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSkipPhase(phaseId: string) {
    setActionLoading(true)
    try {
      // Use approve endpoint but with SKIPPED — we'll use a dedicated skip endpoint
      const res = await fetch(`/api/phases/${phaseId}/skip`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        console.error("Failed to skip phase:", err.error)
        return
      }
      fetchEngagement()
    } catch (err) {
      console.error("Failed to skip phase:", err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSetWorkflowPath(path: "NO_RESPONSE" | "HAS_RESPONSE") {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/engagements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowPath: path }),
      })
      if (res.ok) {
        fetchEngagement()
      }
    } catch (err) {
      console.error("Failed to set workflow path:", err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !engagement) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>
  }

  const { phases, workflowPath } = engagement

  // Build status map for phase-chain functions
  const phaseStatuses: Record<string, string> = {}
  for (const p of phases) {
    phaseStatuses[p.phaseNumber] = p.status
  }

  // Filter visible phases based on workflow path
  const visibleDefs = getVisiblePhases(workflowPath)
  const visiblePhases = visibleDefs
    .map((def) => phases.find((p) => p.phaseNumber === def.number))
    .filter((p): p is PhaseWithId => p !== undefined)

  // Determine current state
  const runningPhases = phases.filter((p) => p.status === "RUNNING")
  const reviewPhases = phases.filter((p) => p.status === "REVIEW")
  const showDecisionFork = shouldShowDecisionFork(phaseStatuses, workflowPath)

  // Find actionable pending phases (can be started)
  const actionablePending = visiblePhases.filter((p) => {
    if (p.status !== "PENDING") return false
    const { canStart } = canStartPhase(p.phaseNumber, phaseStatuses, workflowPath)
    return canStart
  })

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Left: Phase timeline + action cards */}
      <div className="flex flex-col gap-3 md:w-[55%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Phases
        </h2>
        <PhaseTimeline
          phases={visiblePhases}
          onPhaseClick={(phaseNumber) => router.push(`/engagements/${id}/phases/${phaseNumber}`)}
        />

        {/* Running phase indicator */}
        {runningPhases.map((p) => (
          <div key={p.id} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start gap-2">
              <Loader2 className="size-4 text-blue-500 shrink-0 mt-0.5 animate-spin" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)} is running...
                </p>
                <p className="text-xs text-muted-foreground">The agent is generating artefacts. This updates automatically.</p>
              </div>
            </div>
          </div>
        ))}

        {/* Review phase cards */}
        {reviewPhases.map((p) => (
          <div key={p.id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Eye className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Review Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground">Artefacts ready for review. Approve to continue.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                onClick={() => router.push(`/engagements/${id}/phases/${p.phaseNumber}`)}
              >
                <Eye className="size-4" />
                Review
              </Button>
            </div>
          </div>
        ))}

        {/* Decision Fork — shown after Phase 0+1 approved, no path chosen */}
        {showDecisionFork && (
          <div className="rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex items-start gap-2 mb-4">
              <GitFork className="size-5 text-purple-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                  Choose workflow path
                </p>
                <p className="text-xs text-muted-foreground">
                  Research and TOR Assessment are complete. How would you like to proceed?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSetWorkflowPath("HAS_RESPONSE")}
                disabled={actionLoading}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-green-300 hover:bg-green-50/50 dark:hover:border-green-700 dark:hover:bg-green-900/10 disabled:opacity-50"
              >
                <FileQuestion className="size-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">Customer responded to queries</p>
                  <p className="text-xs text-muted-foreground">
                    Upload Q&A responses, then upload or generate estimates, followed by review & gap analysis.
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleSetWorkflowPath("NO_RESPONSE")}
                disabled={actionLoading}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50/50 dark:hover:border-orange-700 dark:hover:bg-orange-900/10 disabled:opacity-50"
              >
                <FileSpreadsheet className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">Customer won't respond — generate optimistic estimates</p>
                  <p className="text-xs text-muted-foreground">
                    Proceed with assumption-heavy estimates based on TOR analysis. All questions become assumptions with change-request boundaries.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Actionable pending phases */}
        {!showDecisionFork && actionablePending.map((p) => {
          const def = visibleDefs.find((d) => d.number === p.phaseNumber)
          const isOptional = def?.optional ?? false
          const isUploadPhase = p.phaseNumber === "2" || p.phaseNumber === "3"

          return (
            <div key={p.id} className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">
                      Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isUploadPhase
                        ? "Upload files or run the AI agent for this phase."
                        : "Ready to run. Trigger when ready."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOptional && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={actionLoading}
                      onClick={() => handleSkipPhase(p.id)}
                    >
                      <SkipForward className="size-4" />
                      Skip
                    </Button>
                  )}
                  {isUploadPhase ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => router.push(`/engagements/${id}/phases/${p.phaseNumber}`)}
                    >
                      Open
                    </Button>
                  ) : (
                    <RunPhaseButton
                      phaseNumber={p.phaseNumber}
                      disabled={actionLoading}
                      onConfirm={() => handleRunPhase(p.id)}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* All done */}
        {!showDecisionFork &&
         runningPhases.length === 0 &&
         reviewPhases.length === 0 &&
         actionablePending.length === 0 &&
         phases.every((p) => p.status === "APPROVED" || p.status === "SKIPPED") && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">All phases complete</p>
                <p className="text-xs text-muted-foreground">The engagement is fully processed.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Summary stats */}
      <div className="flex flex-col gap-3 md:w-[45%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Summary
        </h2>
        <EngagementStats stats={EMPTY_STATS} />
      </div>
    </div>
  )
}
