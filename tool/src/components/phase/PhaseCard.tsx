"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Loader2,
  Circle,
  AlertCircle,
  XCircle,
  Eye,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCost, formatTokens } from "@/lib/format-cost"
import { ModelOverrideSelect } from "@/components/phase/ModelOverrideSelect"

export type PhaseStatus =
  | "PENDING"
  | "RUNNING"
  | "REVIEW"
  | "APPROVED"
  | "SKIPPED"
  | "FAILED"

export interface PhaseCardData {
  phaseNumber: string
  status: PhaseStatus
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  artefactCount?: number
  summary?: string
  /** Phase is locked because workflow decision hasn't been made */
  locked?: boolean
  tokenCount?: number
  costUsd?: number
  /** DB id of this phase row (required to enable model override UI) */
  phaseId?: string
  /** Current modelOverride value from DB (null = using default) */
  modelOverride?: string | null
  /** Allow the operator to change the model override from this card */
  canEditModel?: boolean
}

const PHASE_LABELS: Record<string, string> = {
  "0": "Research",
  "1": "TOR Assessment",
  "1A": "Optimistic Estimate",
  "2": "Responses",
  "3": "Informed Estimates",
  "3R": "Review & Gap Analysis",
  "5": "Technical Proposal",
}

const STATUS_CONFIG: Record<
  PhaseStatus,
  {
    icon: React.ComponentType<{ className?: string }>
    iconClass: string
    badgeClass: string
    label: string
  }
> = {
  APPROVED: {
    icon: CheckCircle2,
    iconClass: "text-green-500",
    badgeClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
    label: "Approved",
  },
  RUNNING: {
    icon: Loader2,
    iconClass: "text-blue-500 animate-spin",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Running",
  },
  PENDING: {
    icon: Circle,
    iconClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
    label: "Pending",
  },
  FAILED: {
    icon: AlertCircle,
    iconClass: "text-red-500",
    badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
    label: "Failed",
  },
  SKIPPED: {
    icon: XCircle,
    iconClass: "text-slate-400",
    badgeClass: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
    label: "Skipped",
  },
  REVIEW: {
    icon: Eye,
    iconClass: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Review",
  },
}

function formatDuration(startedAt: Date | string, completedAt: Date | string): string {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diffMs = end - start
  const diffMins = Math.floor(diffMs / 60000)
  const diffSecs = Math.floor((diffMs % 60000) / 1000)
  if (diffMins === 0) return `${diffSecs}s`
  if (diffMins < 60) return `${diffMins}m ${diffSecs}s`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m`
}

interface PhaseCardProps {
  phase: PhaseCardData
  onClick?: (phaseNumber: string) => void
  className?: string
}

export function PhaseCard({ phase, onClick, className }: PhaseCardProps) {
  const config = STATUS_CONFIG[phase.locked ? "PENDING" : phase.status]
  const Icon = phase.locked ? Lock : config.icon
  const iconClass = phase.locked ? "text-slate-400" : config.iconClass
  const label = PHASE_LABELS[phase.phaseNumber] ?? `Phase ${phase.phaseNumber}`
  const isClickable = !phase.locked && (phase.status !== "PENDING" || onClick !== undefined)
  const duration =
    phase.startedAt && phase.completedAt
      ? formatDuration(phase.startedAt, phase.completedAt)
      : null

  // Pulse the status icon briefly when status changes
  const [iconKey, setIconKey] = React.useState(phase.status)
  const [pulsing, setPulsing] = React.useState(false)
  React.useEffect(() => {
    if (phase.status !== iconKey) {
      setIconKey(phase.status)
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 400)
      return () => clearTimeout(t)
    }
  }, [phase.status, iconKey])

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={() => onClick?.(phase.phaseNumber)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          onClick(phase.phaseNumber)
        }
      }}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-3 text-sm ring-foreground/10",
        "ring-1 transition-all duration-200",
        isClickable &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          iconClass,
          pulsing && "animate-pulse-once"
        )}
      />
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium text-foreground">
            Phase {phase.phaseNumber}: {label}
          </span>
          <Badge
            className={cn(
              "border text-xs font-medium",
              phase.locked
                ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                : config.badgeClass
            )}
            variant="outline"
          >
            {phase.locked ? "Locked" : config.label}
          </Badge>
        </div>
        {(duration !== null || (phase.artefactCount !== undefined && phase.artefactCount > 0) || (phase.costUsd !== undefined && phase.costUsd > 0)) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {duration !== null && <span>{duration}</span>}
            {phase.artefactCount !== undefined && phase.artefactCount > 0 && (
              <span>{phase.artefactCount} artefact{phase.artefactCount !== 1 ? "s" : ""}</span>
            )}
            {phase.costUsd !== undefined && phase.costUsd > 0 && (
              <span className="font-mono tabular-nums">{formatCost(phase.costUsd)}</span>
            )}
            {phase.tokenCount !== undefined && phase.tokenCount > 0 && (
              <span className="font-mono tabular-nums">{formatTokens(phase.tokenCount)}</span>
            )}
          </div>
        )}
        {phase.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{phase.summary}</p>
        )}
        {phase.phaseId &&
          phase.canEditModel &&
          (phase.status === "PENDING" ||
            phase.status === "FAILED" ||
            phase.status === "APPROVED") && (
            <ModelOverrideSelect
              phaseId={phase.phaseId}
              currentOverride={phase.modelOverride}
              disabled={false}
            />
          )}
      </div>
    </div>
  )
}

export { PHASE_LABELS, STATUS_CONFIG, formatDuration }
