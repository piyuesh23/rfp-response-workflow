"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { PhaseTimeline } from "@/components/phase/PhaseTimeline"
import type { PhaseCardData } from "@/components/phase/PhaseCard"
import { EngagementStats, type EngagementStatsData } from "@/components/engagement/EngagementStats"
import { RunPhaseButton } from "@/components/phase/RunPhaseButton"
import { ArrowRight, Loader2, CheckCircle2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PhaseWithId extends PhaseCardData {
  id: string
}

// Derive the "next action" from the current phase statuses.
type NextActionVariant = "review" | "running" | "pending" | "done"

interface NextAction {
  variant: NextActionVariant
  title: string
  description: string
  pendingPhase?: PhaseWithId
  reviewPhase?: PhaseWithId
}

function deriveNextAction(phases: PhaseWithId[]): NextAction {
  const running = phases.find((p) => p.status === "RUNNING")
  if (running) {
    return {
      variant: "running",
      title: `Phase ${running.phaseNumber} is running…`,
      description: "The agent is currently generating artefacts. This may take a few minutes.",
    }
  }

  const inReview = phases.find((p) => p.status === "REVIEW")
  if (inReview) {
    const label =
      ({
        "0": "Research",
        "1": "TOR Analysis",
        "1A": "Estimation",
        "2": "Responses",
        "3": "Review",
        "4": "Gap Analysis",
        "5": "Knowledge Capture",
      } as Record<string, string>)[inReview.phaseNumber] ?? `Phase ${inReview.phaseNumber}`
    return {
      variant: "review",
      title: `Approve Phase ${inReview.phaseNumber} to continue`,
      description: `${label} artefacts are ready for review. Approve to unlock the next phase.`,
      reviewPhase: inReview,
    }
  }

  const allApproved = phases.every((p) => p.status === "APPROVED" || p.status === "SKIPPED")
  if (allApproved) {
    return {
      variant: "done",
      title: "All phases complete",
      description: "The engagement is fully processed. Capture learnings via Phase 5.",
    }
  }

  const nextPending = phases.find((p) => p.status === "PENDING")
  if (nextPending) {
    const label =
      ({
        "0": "Research",
        "1": "TOR Analysis",
        "1A": "Estimation",
        "2": "Responses",
        "3": "Review",
        "4": "Gap Analysis",
        "5": "Knowledge Capture",
      } as Record<string, string>)[nextPending.phaseNumber] ?? `Phase ${nextPending.phaseNumber}`
    return {
      variant: "pending",
      title: `Run Phase ${nextPending.phaseNumber}: ${label}`,
      description: "The previous phase is approved. Trigger the next phase when ready.",
      pendingPhase: nextPending,
    }
  }

  return {
    variant: "done",
    title: "Engagement up to date",
    description: "No pending actions at this time.",
  }
}

const NEXT_ACTION_STYLES: Record<
  NextActionVariant,
  { border: string; icon: React.ReactNode; titleClass: string }
> = {
  review: {
    border: "border-amber-200 dark:border-amber-800",
    icon: <Eye className="size-4 text-amber-500 shrink-0 mt-0.5" />,
    titleClass: "text-amber-700 dark:text-amber-400",
  },
  running: {
    border: "border-blue-200 dark:border-blue-800",
    icon: <Loader2 className="size-4 text-blue-500 shrink-0 mt-0.5 animate-spin" />,
    titleClass: "text-blue-700 dark:text-blue-400",
  },
  pending: {
    border: "border-border",
    icon: <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />,
    titleClass: "text-foreground",
  },
  done: {
    border: "border-green-200 dark:border-green-800",
    icon: <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />,
    titleClass: "text-green-700 dark:text-green-400",
  },
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
  const [phases, setPhases] = React.useState<PhaseWithId[]>([])
  const [loading, setLoading] = React.useState(true)
  const [runningPhase, setRunningPhase] = React.useState(false)

  function fetchEngagement() {
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.phases) {
          setPhases(
            data.phases.map((p: { id: string; phaseNumber: string; status: string; startedAt?: string; completedAt?: string; artefacts?: unknown[] }) => ({
              id: p.id,
              phaseNumber: p.phaseNumber,
              status: p.status,
              startedAt: p.startedAt ?? null,
              completedAt: p.completedAt ?? null,
              artefactCount: p.artefacts?.length ?? 0,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchEngagement()
  }, [id])

  // SSE auto-refresh: subscribe to running phase's SSE stream
  // When the phase completes or fails, re-fetch engagement data
  React.useEffect(() => {
    const runningPhaseData = phases.find((p) => p.status === "RUNNING")
    if (!runningPhaseData) return

    const eventSource = new EventSource(`/api/phases/${runningPhaseData.id}/sse`)

    const handleDone = () => {
      eventSource.close()
      fetchEngagement()
    }

    const handleError = () => {
      eventSource.close()
      fetchEngagement()
    }

    eventSource.addEventListener("done", handleDone)
    eventSource.addEventListener("error", handleError)

    return () => {
      eventSource.removeEventListener("done", handleDone)
      eventSource.removeEventListener("error", handleError)
      eventSource.close()
    }
  }, [phases])

  async function handleRunPhase(phaseId: string) {
    setRunningPhase(true)
    try {
      const res = await fetch(`/api/phases/${phaseId}/run`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        console.error("Failed to run phase:", err.error)
        return
      }
      // Refresh phases to show RUNNING status
      fetchEngagement()
    } catch (err) {
      console.error("Failed to run phase:", err)
    } finally {
      setRunningPhase(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>
  }

  const nextAction = deriveNextAction(phases)
  const actionStyles = NEXT_ACTION_STYLES[nextAction.variant]

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Left: Phase timeline + next action */}
      <div className="flex flex-col gap-3 md:w-[55%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Phases
        </h2>
        <PhaseTimeline
          phases={phases}
          onPhaseClick={(phaseNumber) => router.push(`/engagements/${id}/phases/${phaseNumber}`)}
        />

        {/* Next Action card */}
        <div
          className={`rounded-xl border bg-card p-4 ring-1 ring-foreground/10 ${actionStyles.border}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {actionStyles.icon}
              <div className="flex flex-col gap-0.5">
                <p className={`text-sm font-semibold ${actionStyles.titleClass}`}>
                  {nextAction.title}
                </p>
                <p className="text-xs text-muted-foreground">{nextAction.description}</p>
              </div>
            </div>
            {nextAction.pendingPhase && (
              <RunPhaseButton
                phaseNumber={nextAction.pendingPhase.phaseNumber}
                disabled={runningPhase}
                onConfirm={() => handleRunPhase(nextAction.pendingPhase!.id)}
              />
            )}
            {nextAction.reviewPhase && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                onClick={() => router.push(`/engagements/${id}/phases/${nextAction.reviewPhase!.phaseNumber}`)}
              >
                <Eye className="size-4" />
                Review Artefacts
              </Button>
            )}
          </div>
        </div>
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
