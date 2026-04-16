"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type AccuracyStatus = "PASS" | "WARN" | "FAIL"

interface PhaseAccuracyReport {
  score: number
  status: AccuracyStatus
  gapCount: number
  orphanCount: number
  confFormulaViolations: number
  noBenchmarkCount: number
  ranAt: string
}

interface AccuracyResponse {
  overall: { score: number; status: AccuracyStatus }
  byPhase: Record<string, PhaseAccuracyReport | null>
  lastRunAt: string
}

interface AccuracyScoreCardProps {
  engagementId: string
}

const PHASE_ORDER = ["1", "1A", "3", "4", "5"] as const

function tierForScore(score: number): {
  barClass: string
  textClass: string
  bgClass: string
} {
  if (score >= 0.9) {
    return {
      barClass: "bg-green-500",
      textClass: "text-green-600 dark:text-green-500",
      bgClass: "bg-green-500/10",
    }
  }
  if (score >= 0.75) {
    return {
      barClass: "bg-amber-500",
      textClass: "text-amber-600 dark:text-amber-500",
      bgClass: "bg-amber-500/10",
    }
  }
  return {
    barClass: "bg-red-500",
    textClass: "text-red-600 dark:text-red-500",
    bgClass: "bg-red-500/10",
  }
}

function statusBadgeVariant(
  status: AccuracyStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PASS":
      return "default"
    case "WARN":
      return "secondary"
    case "FAIL":
      return "destructive"
  }
}

function formatPct(score: number): string {
  return `${Math.round(score * 100)}%`
}

export function AccuracyScoreCard({ engagementId }: AccuracyScoreCardProps) {
  const [data, setData] = React.useState<AccuracyResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notComputed, setNotComputed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotComputed(false)
    fetch(`/api/engagements/${engagementId}/accuracy`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setNotComputed(true)
          setData(null)
          return
        }
        if (!res.ok) {
          setNotComputed(true)
          setData(null)
          return
        }
        const json = (await res.json()) as AccuracyResponse
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) {
          setNotComputed(true)
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [engagementId])

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accuracy Score
        </h3>
        <div className="flex items-center gap-3">
          <div className="h-10 w-20 rounded bg-muted animate-pulse" />
          <div className="h-5 w-14 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  if (notComputed || !data) {
    return (
      <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accuracy Score
        </h3>
        <p className="text-sm text-muted-foreground">
          Not yet computed. Run Phase 1A or 3 to generate a score.
        </p>
      </div>
    )
  }

  const tier = tierForScore(data.overall.score)
  const pct = Math.round(data.overall.score * 100)
  const phasesWithReports = PHASE_ORDER.filter(
    (phase) => data.byPhase[phase] != null
  )

  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accuracy Score
        </h3>
        <Badge variant={statusBadgeVariant(data.overall.status)}>
          {data.overall.status}
        </Badge>
      </div>

      {/* Big number + bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-3xl font-bold tabular-nums",
              tier.textClass
            )}
          >
            {formatPct(data.overall.score)}
          </span>
          <span className="text-xs text-muted-foreground self-end pb-0.5">
            overall
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", tier.barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-phase chips */}
      {phasesWithReports.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {phasesWithReports.map((phase) => {
            const report = data.byPhase[phase]!
            const phaseTier = tierForScore(report.score)
            return (
              <div
                key={phase}
                className="flex items-center gap-2 text-xs"
              >
                <span className="font-medium text-muted-foreground shrink-0 w-16">
                  Phase {phase}:
                </span>
                <span className={cn("font-mono font-semibold tabular-nums", phaseTier.textClass)}>
                  {formatPct(report.score)}
                </span>
                <span className="text-muted-foreground truncate">
                  {" · "}
                  {report.gapCount} gap{report.gapCount === 1 ? "" : "s"}
                  {" · "}
                  {report.orphanCount} orphan{report.orphanCount === 1 ? "" : "s"}
                  {" · "}
                  {report.confFormulaViolations} conf
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Drill-down link */}
      <div className="flex justify-end">
        <Link
          href={`/engagements/${engagementId}/accuracy`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View details
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
