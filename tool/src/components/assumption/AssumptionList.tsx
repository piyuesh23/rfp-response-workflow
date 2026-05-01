"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AssumptionActions } from "@/components/assumption/AssumptionActions"
import { cn } from "@/lib/utils"

export type AssumptionStatus = "ACTIVE" | "CONFIRMED" | "REJECTED" | "SUPERSEDED"
export type AssumptionCategory = "SCOPE" | "REGULATORY" | "INTEGRATION" | "MIGRATION" | "OPERATIONAL" | "PERFORMANCE"

export interface Assumption {
  id: string
  code?: string | null
  text: string
  torReference: string
  impactIfWrong: string
  status: AssumptionStatus
  category?: AssumptionCategory | null
  regulationContext?: string | null
  crBoundaryEffect?: string | null
  sourcePhase: string
}

interface AssumptionListProps {
  assumptions: Assumption[]
  onStatusChange?: (id: string, newStatus: AssumptionStatus) => void
}

const STATUS_CONFIG: Record<
  AssumptionStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  },
  CONFIRMED: {
    label: "Confirmed",
    className:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  },
  SUPERSEDED: {
    label: "Superseded",
    className:
      "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
}

const CATEGORY_CONFIG: Partial<Record<AssumptionCategory, { label: string; className: string }>> = {
  REGULATORY: {
    label: "Regulatory",
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
  },
  INTEGRATION: {
    label: "Integration",
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  },
  MIGRATION: {
    label: "Migration",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  OPERATIONAL: {
    label: "Operational",
    className: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  },
  PERFORMANCE: {
    label: "Performance",
    className: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800",
  },
}

function AssumptionRow({
  assumption,
  onStatusChange,
}: {
  assumption: Assumption
  onStatusChange?: (id: string, newStatus: AssumptionStatus) => void
}) {
  const status = STATUS_CONFIG[assumption.status]
  const categoryConfig = assumption.category ? CATEGORY_CONFIG[assumption.category] : undefined

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-opacity",
        assumption.status === "SUPERSEDED" || assumption.status === "REJECTED"
          ? "opacity-60"
          : ""
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {assumption.code && (
          <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">{assumption.code}</span>
        )}
        <p className="flex-1 text-sm font-medium leading-relaxed">{assumption.text}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {categoryConfig && (
            <Badge variant="outline" className={cn("text-xs", categoryConfig.className)}>
              {categoryConfig.label}
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-xs", status.className)}>
            {status.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">TOR Reference: </span>
          {assumption.torReference}
        </div>
        <div>
          <span className="font-semibold text-foreground">Impact if Wrong: </span>
          {assumption.impactIfWrong}
        </div>
        {assumption.crBoundaryEffect && (
          <div className="sm:col-span-2 rounded bg-amber-50 px-2 py-1.5 dark:bg-amber-950/20">
            <span className="font-semibold text-amber-800 dark:text-amber-400">CR Trigger: </span>
            <span className="text-amber-700 dark:text-amber-300">{assumption.crBoundaryEffect}</span>
          </div>
        )}
        {assumption.regulationContext && (
          <div className="sm:col-span-2 rounded bg-purple-50 px-2 py-1.5 dark:bg-purple-950/20">
            <span className="font-semibold text-purple-800 dark:text-purple-400">Regulation: </span>
            <span className="text-purple-700 dark:text-purple-300">{assumption.regulationContext}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        <AssumptionActions
          assumptionId={assumption.id}
          currentStatus={assumption.status}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  )
}

export function AssumptionList({ assumptions, onStatusChange }: AssumptionListProps) {
  // Group by source phase
  const grouped = assumptions.reduce<Record<string, Assumption[]>>((acc, a) => {
    if (!acc[a.sourcePhase]) acc[a.sourcePhase] = []
    acc[a.sourcePhase].push(a)
    return acc
  }, {})

  const phases = Object.keys(grouped).sort()

  if (assumptions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No assumptions match the current filter.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {phases.map((phase) => (
        <div key={phase} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {phase}
            </h3>
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {grouped[phase].length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {grouped[phase].map((assumption) => (
              <AssumptionRow
                key={assumption.id}
                assumption={assumption}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
