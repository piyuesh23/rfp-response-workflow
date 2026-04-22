"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { PhaseTimeline } from "@/components/phase/PhaseTimeline"
import type { PhaseCardData } from "@/components/phase/PhaseCard"
import { EngagementStats, type EngagementStatsData } from "@/components/engagement/EngagementStats"
import { AccuracyScoreCard } from "@/components/engagement/AccuracyScoreCard"
import { CollapsibleSection } from "@/components/engagement/CollapsibleSection"
import { outcomeLabels } from "@/lib/engagement-labels"
import { RunPhaseButton } from "@/components/phase/RunPhaseButton"
import {
  ArrowRight, Loader2, CheckCircle2, Eye,
  GitFork, FileQuestion, FileSpreadsheet, SkipForward,
  Circle, Download, FileDown, Lock, AlertCircle, RotateCcw, X,
} from "lucide-react"
import { rfpSourceLabels, lossReasonLabels } from "@/lib/engagement-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getVisiblePhases, shouldShowDecisionFork, canStartPhase, getPhaseLabel,
  isPhasePathSkipped,
} from "@/lib/phase-chain"
import { usePhaseNotifications } from "@/hooks/usePhaseNotifications"
import { ProgressStream } from "@/components/phase/ProgressStream"
import type { WorkflowPath } from "@/lib/phase-chain"

interface TemplateStatus {
  questionsRfp?: boolean
  salesDetail?: boolean
  backend?: boolean
  frontend?: boolean
  fixedCost?: boolean
  design?: boolean
  ai?: boolean
}

interface PhaseWithId extends PhaseCardData {
  id: string
}

interface EngagementData {
  id: string
  projectName?: string | null
  workflowPath: WorkflowPath
  templateFileUrl?: string | null
  templateStatus?: TemplateStatus | null
  estimatedBudget?: number | null
  financialProposalValue?: number | null
  outcome?: string | null
  lossReason?: string | null
  lossReasonDetail?: string | null
  actualContractValue?: number | null
  competitorWhoWon?: string | null
  winFactors?: string[]
  outcomeFeedback?: string | null
  industry?: string | null
  // Business metadata
  rfpSource?: string | null
  estimatedDealValue?: number | null
  submissionDeadline?: string | null
  presalesOwner?: string | null
  salesOwner?: string | null
  isCompetitiveBid?: boolean
  presalesHoursSpent?: number | null
  phases: PhaseWithId[]
}

const EMPTY_STATS: EngagementStatsData = {
  totalHours: { low: 0, high: 0 },
  hoursByTab: {
    backend: { low: 0, high: 0 },
    frontend: { low: 0, high: 0 },
    fixedCost: { low: 0, high: 0 },
    design: { low: 0, high: 0 },
    ai: { low: 0, high: 0 },
  },
  requirementCount: 0,
  clarityBreakdown: { clear: 0, needsClarification: 0, ambiguous: 0, missingDetail: 0 },
  confidenceDistribution: { high56: 0, medium4: 0, low123: 0 },
  riskCount: { total: 0, high: 0, medium: 0, low: 0 },
  assumptionCount: { total: 0, resolved: 0, open: 0 },
  costData: null,
}

/** Extract a one-line summary from phase artefact metadata for display in phase cards. */
function extractPhaseSummary(
  phaseNumber: string,
  artefacts: Array<{ metadata?: Record<string, unknown> }>
): string | undefined {
  // Find the latest artefact with metadata
  const meta = artefacts
    .map((a) => a.metadata)
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .pop()

  if (!meta) return undefined

  switch (phaseNumber) {
    case "0": {
      const integrations = meta.integrationsFound as number | undefined
      const hidden = meta.hiddenScopeItems as number | undefined
      const risks = meta.riskCount as number | undefined
      if (!integrations && !hidden && !risks) return undefined
      const parts: string[] = []
      if (integrations) parts.push(`${integrations} integrations`)
      if (hidden) parts.push(`${hidden} hidden scope items`)
      if (risks) parts.push(`${risks} risks`)
      return parts.join(" · ")
    }
    case "1": {
      const reqCount = meta.requirementCount as number | undefined
      const clarity = meta.clarityBreakdown as { clear?: number; needsClarification?: number; ambiguous?: number; missingDetail?: number } | undefined
      if (!reqCount) return undefined
      const clear = clarity?.clear ?? 0
      const needs = (clarity?.needsClarification ?? 0) + (clarity?.ambiguous ?? 0) + (clarity?.missingDetail ?? 0)
      return `${reqCount} requirements assessed (${clear} clear, ${needs} need clarification)`
    }
    case "1A":
    case "3": {
      const total = meta.totalHours as { low?: number; high?: number } | undefined
      const lineItems = meta.lineItemCount as number | undefined
      if (!total?.low && !total?.high) return undefined
      const bv = meta.benchmarkValidation as { passCount?: number; warnCount?: number; failCount?: number; totalItems?: number } | undefined
      const validationSuffix = bv && bv.totalItems
        ? ` · BM: ${bv.passCount ?? 0}P/${bv.warnCount ?? 0}W/${bv.failCount ?? 0}F`
        : ""
      return `${lineItems ?? "?"} line items · ${total?.low ?? 0}–${total?.high ?? 0} hrs${validationSuffix}`
    }
    default:
      return undefined
  }
}

export default function EngagementOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [engagement, setEngagement] = React.useState<EngagementData | null>(null)
  const [stats, setStats] = React.useState<EngagementStatsData>(EMPTY_STATS)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

  const fetchEngagement = React.useCallback(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setEngagement({
            id: data.id,
            projectName: data.projectName ?? null,
            workflowPath: data.workflowPath ?? null,
            templateFileUrl: data.templateFileUrl ?? null,
            templateStatus: data.templateStatus ?? null,
            estimatedBudget: data.estimatedBudget ?? null,
            financialProposalValue: data.financialProposalValue ?? null,
            outcome: data.outcome ?? null,
            lossReason: data.lossReason ?? null,
            lossReasonDetail: data.lossReasonDetail ?? null,
            actualContractValue: data.actualContractValue ?? null,
            competitorWhoWon: data.competitorWhoWon ?? null,
            winFactors: data.winFactors ?? [],
            outcomeFeedback: data.outcomeFeedback ?? null,
            industry: data.account?.industry ?? null,
            rfpSource: data.rfpSource ?? null,
            estimatedDealValue: data.estimatedDealValue ?? null,
            submissionDeadline: data.submissionDeadline ?? null,
            presalesOwner: data.presalesOwner ?? null,
            salesOwner: data.salesOwner ?? null,
            isCompetitiveBid: data.isCompetitiveBid ?? true,
            presalesHoursSpent: data.presalesHoursSpent ?? null,
            phases: (data.phases ?? []).map(
              (p: { id: string; phaseNumber: string; status: string; startedAt?: string; completedAt?: string; artefacts?: Array<{ metadata?: Record<string, unknown> }> }) => ({
                id: p.id,
                phaseNumber: p.phaseNumber,
                status: p.status,
                startedAt: p.startedAt ?? null,
                completedAt: p.completedAt ?? null,
                artefactCount: p.artefacts?.length ?? 0,
                summary: extractPhaseSummary(p.phaseNumber, p.artefacts ?? []),
              })
            ),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch stats in parallel
    fetch(`/api/engagements/${id}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data)
      })
      .catch(() => {})
  }, [id])

  React.useEffect(() => {
    fetchEngagement()
  }, [fetchEngagement])

  /** Patch engagement fields via the general PATCH endpoint */
  const patchEngagement = React.useCallback(
    async (fields: Record<string, unknown>) => {
      await fetch(`/api/engagements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      fetchEngagement()
    },
    [id, fetchEngagement]
  )

  /** Patch outcome-related fields via the dedicated outcome endpoint */
  const patchOutcome = React.useCallback(
    async (fields: Record<string, unknown>) => {
      if (!engagement?.outcome) return
      await fetch(`/api/engagements/${id}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: engagement.outcome, ...fields }),
      })
      fetchEngagement()
    },
    [id, engagement?.outcome, fetchEngagement]
  )

  // ProgressStream renders its own SSE per running phase and calls fetchEngagement on complete/error.
  const runningPhase = engagement?.phases.find((p) => p.status === "RUNNING") ?? null

  // Polling while any phase is running — updates templateStatus and other engagement data
  const anyRunning = (engagement?.phases ?? []).some((p) => p.status === "RUNNING")
  React.useEffect(() => {
    if (!anyRunning) return
    const interval = setInterval(fetchEngagement, 5000)
    return () => clearInterval(interval)
  }, [anyRunning, fetchEngagement])

  // Browser notifications for running phase completion
  usePhaseNotifications({
    phaseId: runningPhase?.id ?? null,
    engagementId: id,
    phaseNumber: runningPhase?.phaseNumber ?? "",
    phaseLabel: runningPhase ? getPhaseLabel(runningPhase.phaseNumber) : "",
    enabled: !!runningPhase,
  })

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

  // Build per-phase cost lookup from stats
  const costByPhase = new Map<string, { totalTokens: number; estimatedCostUsd: number }>()
  if (stats.costData?.byPhase) {
    for (const entry of stats.costData.byPhase) {
      costByPhase.set(entry.phaseNumber, {
        totalTokens: entry.totalTokens,
        estimatedCostUsd: entry.estimatedCostUsd,
      })
    }
  }

  // Show all phases - phases from the non-chosen path display as "Skipped"
  const visibleDefs = getVisiblePhases(workflowPath)
  const visiblePhases = visibleDefs
    .map((def) => {
      const p = phases.find((ph) => ph.phaseNumber === def.number)
      if (!p) return undefined
      // Enrich with cost data
      const cost = costByPhase.get(p.phaseNumber)
      const enriched = {
        ...p,
        ...(cost ? { tokenCount: cost.totalTokens, costUsd: cost.estimatedCostUsd } : {}),
      }
      // Override status to SKIPPED for phases on the inactive workflow path
      if (isPhasePathSkipped(p.phaseNumber, workflowPath) && p.status === "PENDING") {
        return { ...enriched, status: "SKIPPED" as const }
      }
      // Mark phases as locked if they need a workflow decision that hasn't been made
      if (p.status === "PENDING" && def.workflowPath !== null && workflowPath === null) {
        return { ...enriched, locked: true }
      }
      // Phase 5 is locked until workflow is chosen
      if (p.status === "PENDING" && def.number === "5" && workflowPath === null) {
        return { ...enriched, locked: true }
      }
      return enriched
    })
    .filter((p): p is PhaseWithId => p !== undefined)

  // Determine current state
  const runningPhases = phases.filter((p) => p.status === "RUNNING")
  const reviewPhases = phases.filter((p) => p.status === "REVIEW")
  const failedPhases = phases.filter((p) => p.status === "FAILED")
  const showDecisionFork = shouldShowDecisionFork(phaseStatuses, workflowPath)

  // Find actionable pending phases (can be started)
  const actionablePending = visiblePhases.filter((p) => {
    if (p.status !== "PENDING") return false
    const { canStart } = canStartPhase(p.phaseNumber, phaseStatuses, workflowPath)
    return canStart
  })

  // Find locked phases (pending but blocked by missing workflow decision)
  const lockedPhases = visiblePhases.filter((p) => {
    if (p.status !== "PENDING") return false
    const { canStart, reason } = canStartPhase(p.phaseNumber, phaseStatuses, workflowPath)
    return !canStart && reason?.includes("Workflow decision")
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

        {/* Running phase live log stream */}
        {runningPhases.map((p) => (
          <div key={p.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Loader2 className="size-4 text-blue-500 shrink-0 animate-spin" />
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)} is running...
              </p>
            </div>
            <ProgressStream
              phaseId={p.id}
              onComplete={fetchEngagement}
              onError={fetchEngagement}
            />
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

        {/* Failed phase retry cards */}
        {failedPhases.map((p) => (
          <div key={p.id} className="rounded-xl border border-red-200 dark:border-red-800 bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)} failed
                  </p>
                  <p className="text-xs text-muted-foreground">The agent encountered an error. You can retry.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={actionLoading}
                onClick={() => handleRunPhase(p.id)}
              >
                <RotateCcw className="size-4" />
                Retry
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

        {/* Locked phases — waiting for workflow decision */}
        {lockedPhases.length > 0 && !showDecisionFork && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-card p-4 ring-1 ring-foreground/5">
            <div className="flex items-start gap-2 mb-2">
              <Lock className="size-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Locked — choose a workflow path to unlock
              </p>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {lockedPhases.map((p) => (
                <span key={p.id} className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Phase {p.phaseNumber}: {getPhaseLabel(p.phaseNumber)}
                </span>
              ))}
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

      {/* Right: Summary stats + template status */}
      <div className="flex flex-col gap-3 md:w-[45%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Summary
        </h2>

        {/* Industry badge */}
        {engagement?.industry && engagement.industry !== "OTHER" && (
          <div className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-medium">
            {engagement.industry.replace(/_/g, " ")}
          </div>
        )}

        {/* Deal & Financials — single collapsible section covering deal, financial, team, outcome */}
        {(() => {
          const fmtMoney = (v: number | null | undefined) => {
            if (!v) return null
            return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
          }
          const fmtDate = (v: string | null | undefined) => {
            if (!v) return null
            try {
              return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            } catch { return null }
          }

          const summaryParts: React.ReactNode[] = []
          if (engagement?.outcome) {
            const tone =
              engagement.outcome === "WON" || engagement.outcome === "PARTIAL_WIN"
                ? "text-green-600 dark:text-green-400 font-medium"
                : engagement.outcome === "LOST"
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-foreground font-medium"
            summaryParts.push(
              <span key="outcome" className={tone}>
                {outcomeLabels[engagement.outcome] ?? engagement.outcome}
              </span>
            )
          }
          if (engagement?.rfpSource) {
            summaryParts.push(rfpSourceLabels[engagement.rfpSource] ?? engagement.rfpSource)
          }
          const dealVal =
            fmtMoney(engagement?.actualContractValue) ??
            fmtMoney(engagement?.estimatedDealValue) ??
            fmtMoney(engagement?.financialProposalValue)
          if (dealVal) summaryParts.push(dealVal)
          const dueDate = fmtDate(engagement?.submissionDeadline)
          if (dueDate) summaryParts.push(`Due ${dueDate}`)

          const summary =
            summaryParts.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                {summaryParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-muted-foreground/50">·</span>}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </span>
            ) : (
              "Not filled in"
            )

          return (
            <div className="rounded-xl border bg-card px-4 ring-1 ring-foreground/10">
              <CollapsibleSection
                title="Deal & Financials"
                summary={summary}
                defaultOpen={false}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Deal Value</label>
                    <input
                      type="number"
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder="Expected deal size"
                      defaultValue={engagement?.estimatedDealValue ?? ""}
                      key={`dealval-${engagement?.estimatedDealValue}`}
                      onBlur={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        if (val !== engagement?.estimatedDealValue) patchEngagement({ estimatedDealValue: val });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">RFP Source</label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={engagement?.rfpSource ?? ""}
                      onChange={(e) => patchEngagement({ rfpSource: e.target.value || null })}
                    >
                      <option value="">--</option>
                      {Object.entries(rfpSourceLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Budget (TOR)</label>
                    <input
                      type="number"
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder="From TOR/RFP"
                      defaultValue={engagement?.estimatedBudget ?? ""}
                      key={`budget-${engagement?.estimatedBudget}`}
                      onBlur={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        if (val !== engagement?.estimatedBudget) patchEngagement({ estimatedBudget: val });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground" title="What we quoted in our proposal, before any negotiation">
                      Proposal Value <span className="text-muted-foreground/70">(our bid)</span>
                    </label>
                    <input
                      type="number"
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder="Our submitted bid"
                      defaultValue={engagement?.financialProposalValue ?? ""}
                      key={`fpv-${engagement?.financialProposalValue}`}
                      onBlur={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        if (val !== engagement?.financialProposalValue) patchEngagement({ financialProposalValue: val });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Submission Deadline</label>
                    <input
                      type="date"
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      defaultValue={engagement?.submissionDeadline ? new Date(engagement.submissionDeadline).toISOString().split("T")[0] : ""}
                      key={`deadline-${engagement?.submissionDeadline}`}
                      onBlur={(e) => {
                        const val = e.target.value || null;
                        patchEngagement({ submissionDeadline: val });
                      }}
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={engagement?.isCompetitiveBid ?? true}
                        onChange={(e) => patchEngagement({ isCompetitiveBid: e.target.checked })}
                      />
                      Competitive Bid
                    </label>
                  </div>
                </div>
                <div className="border-t mt-3 pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Team</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Presales Owner</label>
                      <input
                        type="text"
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="Name"
                        defaultValue={engagement?.presalesOwner ?? ""}
                        key={`presales-${engagement?.presalesOwner}`}
                        onBlur={(e) => {
                          if (e.target.value !== (engagement?.presalesOwner ?? ""))
                            patchEngagement({ presalesOwner: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Sales Owner</label>
                      <input
                        type="text"
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="Name"
                        defaultValue={engagement?.salesOwner ?? ""}
                        key={`sales-${engagement?.salesOwner}`}
                        onBlur={(e) => {
                          if (e.target.value !== (engagement?.salesOwner ?? ""))
                            patchEngagement({ salesOwner: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Hours Spent</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="0"
                        defaultValue={engagement?.presalesHoursSpent ?? ""}
                        key={`hours-${engagement?.presalesHoursSpent}`}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          if (val !== engagement?.presalesHoursSpent) patchEngagement({ presalesHoursSpent: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="border-t mt-3 pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Outcome</div>
                  <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Result</label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={engagement?.outcome ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        if (val) {
                          fetch(`/api/engagements/${id}/outcome`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ outcome: val }),
                          }).then(() => fetchEngagement());
                        } else {
                          patchEngagement({ outcome: null });
                        }
                      }}
                    >
                      <option value="">Not recorded</option>
                      <option value="WON">Won</option>
                      <option value="LOST">Lost</option>
                      <option value="NO_DECISION">No Decision</option>
                      <option value="WITHDRAWN">Withdrawn</option>
                      <option value="PARTIAL_WIN">Partial Win</option>
                      <option value="DEFERRED">Deferred</option>
                      <option value="NOT_SUBMITTED">Not Submitted</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground" title="The value actually signed into the contract after negotiation — only meaningful once the deal is won">
                      Contract Value <span className="text-muted-foreground/70">(signed)</span>
                    </label>
                    <input
                      type="number"
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder="Post-negotiation value"
                      defaultValue={engagement?.actualContractValue ?? ""}
                      key={`cv-${engagement?.actualContractValue}`}
                      onBlur={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        if (val !== engagement?.actualContractValue) patchEngagement({ actualContractValue: val });
                      }}
                    />
                  </div>
                </div>

                {engagement?.outcome === "LOST" && (
                  <div className="border-t mt-3 pt-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Loss Reason</label>
                      <select
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={engagement?.lossReason ?? ""}
                        onChange={(e) => patchOutcome({ lossReason: e.target.value || null })}
                      >
                        <option value="">--</option>
                        {Object.entries(lossReasonLabels).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Details</label>
                      <textarea
                        rows={2}
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm resize-none"
                        placeholder="What happened?"
                        defaultValue={engagement?.lossReasonDetail ?? ""}
                        key={`lrd-${engagement?.lossReasonDetail}`}
                        onBlur={(e) => {
                          if (e.target.value !== (engagement?.lossReasonDetail ?? ""))
                            patchOutcome({ lossReasonDetail: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Competitor Who Won</label>
                      <input
                        type="text"
                        className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="Competitor name"
                        defaultValue={engagement?.competitorWhoWon ?? ""}
                        key={`comp-${engagement?.competitorWhoWon}`}
                        onBlur={(e) => {
                          if (e.target.value !== (engagement?.competitorWhoWon ?? ""))
                            patchOutcome({ competitorWhoWon: e.target.value || null });
                        }}
                      />
                    </div>
                  </div>
                )}

                {(engagement?.outcome === "WON" || engagement?.outcome === "PARTIAL_WIN") && (
                  <div className="border-t mt-3 pt-3">
                    <label className="text-xs text-muted-foreground">Win Factors</label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1.5">
                      {(engagement?.winFactors ?? []).map((factor, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                          {factor}
                          <button
                            type="button"
                            className="ml-0.5 hover:text-destructive"
                            onClick={() => {
                              const updated = (engagement?.winFactors ?? []).filter((_, idx) => idx !== i);
                              patchOutcome({ winFactors: updated });
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder="Type a factor and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            const updated = [...(engagement?.winFactors ?? []), val];
                            patchOutcome({ winFactors: updated });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {engagement?.outcome && (
                  <div className="border-t mt-3 pt-3">
                    <label className="text-xs text-muted-foreground">Feedback & Learnings</label>
                    <textarea
                      rows={2}
                      className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm resize-none"
                      placeholder="Key takeaways from this engagement"
                      defaultValue={engagement?.outcomeFeedback ?? ""}
                      key={`feedback-${engagement?.outcomeFeedback}`}
                      onBlur={(e) => {
                        if (e.target.value !== (engagement?.outcomeFeedback ?? ""))
                          patchOutcome({ outcomeFeedback: e.target.value || null });
                      }}
                    />
                  </div>
                )}
                </div>
              </CollapsibleSection>
            </div>
          )
        })()}

        <AccuracyScoreCard engagementId={id} />

        <EngagementStats stats={stats} />

        {/* Presales Sheet Status */}
        {engagement.templateFileUrl && (
          <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileDown className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{engagement.projectName ?? "Project"} Presales Sheet</span>
              </div>
              <a
                href={`/api/engagements/${id}/files/estimates/Master_Estimate_Template.xlsx`}
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Download className="size-3.5" />
                Download
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "salesDetail", label: "Sales Detail", phases: ["1"] },
                { key: "questionsRfp", label: "Questions for RFP", phases: ["1"] },
                { key: "backend", label: "Backend", phases: ["1A", "3"] },
                { key: "frontend", label: "Frontend", phases: ["1A", "3"] },
                { key: "fixedCost", label: "Fixed Cost Items", phases: ["1A", "3"] },
                { key: "design", label: "Design", phases: ["1A", "3"] },
                { key: "ai", label: "AI", phases: ["1A", "3"] },
              ] as const).map(({ key, label, phases: relevantPhases }) => {
                const done = !!(engagement.templateStatus as TemplateStatus)?.[key]
                const relevantRunning = engagement.phases.some(
                  (p) => (relevantPhases as readonly string[]).includes(p.phaseNumber) && p.status === "RUNNING"
                )
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    {done ? (
                      <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                    ) : relevantRunning ? (
                      <Loader2 className="size-3.5 text-blue-400 shrink-0 animate-spin" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
