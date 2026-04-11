"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatCost, formatTokens } from "@/lib/format-cost"

export interface EngagementStatsData {
  totalHours: { low: number; high: number }
  hoursByTab: {
    backend: { low: number; high: number }
    frontend: { low: number; high: number }
    fixedCost: { low: number; high: number }
    ai: { low: number; high: number }
  }
  requirementCount: number
  clarityBreakdown: {
    clear: number
    needsClarification: number
    ambiguous: number
    missingDetail: number
  }
  confidenceDistribution: {
    high56: number
    medium4: number
    low123: number
  }
  riskCount: { total: number; high: number; medium: number; low: number }
  assumptionCount: { total: number; resolved: number; open: number }
  costData?: {
    totalCostUsd: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    phasesRun: number
    byPhase?: { phaseNumber: string; totalTokens: number; estimatedCostUsd: number }[]
  } | null
}

interface EngagementStatsProps {
  stats: EngagementStatsData
  className?: string
}

function StatCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 ring-1 ring-foreground/10 flex flex-col gap-3",
        className
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

interface HBarProps {
  label: string
  value: number
  max: number
  colorClass: string
}

function HBar({ label, value, max, colorClass }: HBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}h</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface StackedBarSegment {
  value: number
  colorClass: string
  label: string
}

function StackedBar({ segments, total }: { segments: StackedBarSegment[]; total: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5">
      {segments.map((seg) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0
        if (pct === 0) return null
        return (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.value}`}
            className={cn("h-full transition-all duration-500", seg.colorClass)}
            style={{ width: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}

export function EngagementStats({ stats, className }: EngagementStatsProps) {
  const {
    totalHours,
    hoursByTab,
    requirementCount,
    clarityBreakdown,
    confidenceDistribution,
    riskCount,
    assumptionCount,
  } = stats

  const tabMax = Math.max(
    hoursByTab.backend.high,
    hoursByTab.frontend.high,
    hoursByTab.fixedCost.high,
    hoursByTab.ai.high,
    1
  )

  const clarityTotal =
    clarityBreakdown.clear +
    clarityBreakdown.needsClarification +
    clarityBreakdown.ambiguous +
    clarityBreakdown.missingDetail

  const confTotal =
    confidenceDistribution.high56 +
    confidenceDistribution.medium4 +
    confidenceDistribution.low123

  return (
    <div className={cn("grid gap-3 grid-cols-1 sm:grid-cols-2", className)}>
      {/* AI Cost */}
      {stats.costData && stats.costData.phasesRun > 0 && (
        <StatCard title="AI Cost" className="sm:col-span-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums">
              {formatCost(stats.costData.totalCostUsd)}
            </span>
            <span className="text-xs text-muted-foreground self-end pb-0.5">
              across {stats.costData.phasesRun} phase run{stats.costData.phasesRun !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Input: {formatTokens(stats.costData.inputTokens)}</span>
            <span>Output: {formatTokens(stats.costData.outputTokens)}</span>
            <span>Total: {formatTokens(stats.costData.totalTokens)}</span>
          </div>
        </StatCard>
      )}

      {/* Total Hours */}
      <StatCard title="Total Hours" className="sm:col-span-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums">
            {totalHours.low}
          </span>
          <span className="text-muted-foreground text-sm">–</span>
          <span className="font-mono text-3xl font-bold tabular-nums">
            {totalHours.high}
          </span>
          <span className="text-xs text-muted-foreground self-end pb-0.5">hrs</span>
        </div>
        <p className="text-xs text-muted-foreground">Low–High range across all tabs</p>
      </StatCard>

      {/* Hours by Tab */}
      <StatCard title="Hours by Tab">
        <div className="flex flex-col gap-2.5">
          <HBar
            label="Backend"
            value={hoursByTab.backend.high}
            max={tabMax}
            colorClass="bg-blue-500"
          />
          <HBar
            label="Frontend"
            value={hoursByTab.frontend.high}
            max={tabMax}
            colorClass="bg-violet-500"
          />
          <HBar
            label="Fixed Cost"
            value={hoursByTab.fixedCost.high}
            max={tabMax}
            colorClass="bg-slate-400"
          />
          <HBar
            label="AI"
            value={hoursByTab.ai.high}
            max={tabMax}
            colorClass="bg-emerald-500"
          />
        </div>
      </StatCard>

      {/* Requirement Clarity */}
      <StatCard title="Requirement Clarity">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tabular-nums">{requirementCount}</span>
          <span className="text-xs text-muted-foreground">requirements</span>
        </div>
        <StackedBar
          total={clarityTotal}
          segments={[
            { label: "Clear", value: clarityBreakdown.clear, colorClass: "bg-green-500" },
            { label: "Needs Clarification", value: clarityBreakdown.needsClarification, colorClass: "bg-amber-400" },
            { label: "Ambiguous", value: clarityBreakdown.ambiguous, colorClass: "bg-orange-500" },
            { label: "Missing Detail", value: clarityBreakdown.missingDetail, colorClass: "bg-red-500" },
          ]}
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-muted-foreground">Clear</span>
            <span className="ml-auto font-mono font-semibold">{clarityBreakdown.clear}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-muted-foreground">Needs Clarif.</span>
            <span className="ml-auto font-mono font-semibold">{clarityBreakdown.needsClarification}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-500 shrink-0" />
            <span className="text-muted-foreground">Ambiguous</span>
            <span className="ml-auto font-mono font-semibold">{clarityBreakdown.ambiguous}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-muted-foreground">Missing Detail</span>
            <span className="ml-auto font-mono font-semibold">{clarityBreakdown.missingDetail}</span>
          </div>
        </div>
      </StatCard>

      {/* Confidence Distribution */}
      <StatCard title="Confidence Distribution">
        <StackedBar
          total={confTotal}
          segments={[
            { label: "High (5–6)", value: confidenceDistribution.high56, colorClass: "bg-green-500" },
            { label: "Medium (4)", value: confidenceDistribution.medium4, colorClass: "bg-amber-400" },
            { label: "Low (1–3)", value: confidenceDistribution.low123, colorClass: "bg-red-500" },
          ]}
        />
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-muted-foreground">High (Conf 5–6)</span>
            </div>
            <span className="font-mono font-semibold">{confidenceDistribution.high56}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-muted-foreground">Medium (Conf 4)</span>
            </div>
            <span className="font-mono font-semibold">{confidenceDistribution.medium4}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-muted-foreground">Low (Conf 1–3)</span>
            </div>
            <span className="font-mono font-semibold">{confidenceDistribution.low123}</span>
          </div>
        </div>
      </StatCard>

      {/* Risks */}
      <StatCard title="Risk Register">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tabular-nums">{riskCount.total}</span>
          <span className="text-xs text-muted-foreground">risks identified</span>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-muted-foreground">High severity</span>
            </div>
            <span className="font-mono font-semibold">{riskCount.high}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-muted-foreground">Medium severity</span>
            </div>
            <span className="font-mono font-semibold">{riskCount.medium}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-400 shrink-0" />
              <span className="text-muted-foreground">Low severity</span>
            </div>
            <span className="font-mono font-semibold">{riskCount.low}</span>
          </div>
        </div>
      </StatCard>

      {/* Assumptions */}
      <StatCard title="Assumptions">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tabular-nums">{assumptionCount.total}</span>
          <span className="text-xs text-muted-foreground">assumptions logged</span>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-muted-foreground">Resolved</span>
            </div>
            <span className="font-mono font-semibold">{assumptionCount.resolved}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-muted-foreground">Open</span>
            </div>
            <span className="font-mono font-semibold">{assumptionCount.open}</span>
          </div>
        </div>
      </StatCard>
    </div>
  )
}
