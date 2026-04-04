import * as React from "react"
import { PhaseTimeline } from "@/components/phase/PhaseTimeline"
import type { PhaseCardData } from "@/components/phase/PhaseCard"
import { EngagementStats, type EngagementStatsData } from "@/components/engagement/EngagementStats"
import { ArrowRight, Loader2, CheckCircle2, Eye } from "lucide-react"

const MOCK_PHASES: PhaseCardData[] = [
  {
    phaseNumber: "0",
    status: "APPROVED",
    startedAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 6900000),
    artefactCount: 3,
  },
  {
    phaseNumber: "1",
    status: "APPROVED",
    startedAt: new Date(Date.now() - 6800000),
    completedAt: new Date(Date.now() - 6600000),
    artefactCount: 2,
  },
  {
    phaseNumber: "1A",
    status: "REVIEW",
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 1800000),
    artefactCount: 4,
  },
  {
    phaseNumber: "2",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "3",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "4",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "5",
    status: "PENDING",
    artefactCount: 0,
  },
]

const MOCK_STATS: EngagementStatsData = {
  totalHours: { low: 500, high: 680 },
  hoursByTab: {
    backend: { low: 200, high: 280 },
    frontend: { low: 160, high: 220 },
    fixedCost: { low: 80, high: 80 },
    ai: { low: 60, high: 100 },
  },
  requirementCount: 42,
  clarityBreakdown: {
    clear: 28,
    needsClarification: 10,
    ambiguous: 3,
    missingDetail: 1,
  },
  confidenceDistribution: {
    high56: 18,
    medium4: 16,
    low123: 8,
  },
  riskCount: { total: 11, high: 3, medium: 5, low: 3 },
  assumptionCount: { total: 24, resolved: 14, open: 10 },
}

// Derive the "next action" from the current phase statuses.
type NextActionVariant = "review" | "running" | "pending" | "done"

interface NextAction {
  variant: NextActionVariant
  title: string
  description: string
}

function deriveNextAction(phases: PhaseCardData[]): NextAction {
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

export default function EngagementOverviewPage() {
  const nextAction = deriveNextAction(MOCK_PHASES)
  const actionStyles = NEXT_ACTION_STYLES[nextAction.variant]

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Left: Phase timeline + next action */}
      <div className="flex flex-col gap-3 md:w-[55%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Phases
        </h2>
        <PhaseTimeline phases={MOCK_PHASES} />

        {/* Next Action card */}
        <div
          className={`rounded-xl border bg-card p-4 ring-1 ring-foreground/10 ${actionStyles.border}`}
        >
          <div className="flex items-start gap-2">
            {actionStyles.icon}
            <div className="flex flex-col gap-0.5">
              <p className={`text-sm font-semibold ${actionStyles.titleClass}`}>
                {nextAction.title}
              </p>
              <p className="text-xs text-muted-foreground">{nextAction.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Summary stats */}
      <div className="flex flex-col gap-3 md:w-[45%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Summary
        </h2>
        <EngagementStats stats={MOCK_STATS} />
      </div>
    </div>
  )
}
