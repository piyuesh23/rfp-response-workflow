"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Wrench, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Track which entry IDs have already been "seen" so only genuinely new ones animate
const seenIds = new Set<string>()

export type StreamEntryStatus = "running" | "complete" | "error"

export interface StreamEntry {
  id: string
  toolName: string
  status: StreamEntryStatus
  message: string
  timestamp: Date | string
}

interface ProgressStreamProps {
  phaseId: string
  events?: StreamEntry[]
  progress?: number
  className?: string
}

const ENTRY_ICONS: Record<StreamEntryStatus, React.ComponentType<{ className?: string }>> = {
  running: Wrench,
  complete: CheckCircle,
  error: AlertCircle,
}

const ENTRY_ICON_CLASSES: Record<StreamEntryStatus, string> = {
  running: "text-blue-500",
  complete: "text-green-500",
  error: "text-red-500",
}

function formatTime(ts: Date | string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const MOCK_EVENTS: StreamEntry[] = [
  {
    id: "1",
    toolName: "WebSearch",
    status: "complete",
    message: "Customer research completed — 12 results processed",
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: "2",
    toolName: "WebFetch",
    status: "complete",
    message: "Site audit completed — headers, stack, sitemap analysed",
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: "3",
    toolName: "sequential-thinking",
    status: "running",
    message: "Decomposing TOR requirements into estimation categories…",
    timestamp: new Date(Date.now() - 5000),
  },
]

export function ProgressStream({
  phaseId: _phaseId,
  events,
  progress,
  className,
}: ProgressStreamProps) {
  const entries = events ?? MOCK_EVENTS
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const completedCount = entries.filter((e) => e.status === "complete").length
  const computedProgress =
    progress !== undefined
      ? progress
      : entries.length > 0
      ? Math.round((completedCount / entries.length) * 100)
      : 0

  const isActive = computedProgress > 0 && computedProgress < 100

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10", className)}>
      {/* Overall progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">Agent progress</span>
          <span>{computedProgress}%</span>
        </div>
        <div className="relative overflow-hidden rounded-full">
          <Progress value={computedProgress} />
          {isActive && (
            <div className="pointer-events-none absolute inset-0 rounded-full progress-shimmer" />
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="Agent activity log"
      >
        {entries.map((entry) => {
          const isNew = !seenIds.has(entry.id)
          if (isNew) seenIds.add(entry.id)
          const Icon = ENTRY_ICONS[entry.status]
          return (
            <div
              key={entry.id}
              className={cn(
                "flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs",
                isNew && "animate-slide-in-left"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  ENTRY_ICON_CLASSES[entry.status]
                )}
              />
              <Badge
                variant="secondary"
                className="shrink-0 h-4 text-[10px] font-mono px-1.5"
              >
                {entry.toolName}
              </Badge>
              <span className="flex-1 text-foreground leading-relaxed">{entry.message}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums font-mono">
                {formatTime(entry.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
