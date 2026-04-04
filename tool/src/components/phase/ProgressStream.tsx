"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Wrench, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

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
  onComplete?: () => void
  onError?: () => void
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

export function ProgressStream({
  phaseId,
  onComplete,
  onError,
  className,
}: ProgressStreamProps) {
  const [entries, setEntries] = React.useState<StreamEntry[]>([])
  const [connected, setConnected] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const entryCountRef = React.useRef(0)

  React.useEffect(() => {
    const eventSource = new EventSource(`/api/phases/${phaseId}/sse`)

    eventSource.addEventListener("connected", () => {
      setConnected(true)
    })

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data)
        entryCountRef.current += 1
        const entry: StreamEntry = {
          id: String(entryCountRef.current),
          toolName: data.tool ?? "Agent",
          status: "running",
          message: data.message ?? "Processing...",
          timestamp: new Date(),
        }
        setEntries((prev) => {
          // Mark previous running entries as complete
          const updated = prev.map((e) =>
            e.status === "running" ? { ...e, status: "complete" as const } : e
          )
          return [...updated, entry]
        })
      } catch {
        // Ignore malformed events
      }
    })

    eventSource.addEventListener("done", () => {
      setEntries((prev) =>
        prev.map((e) =>
          e.status === "running" ? { ...e, status: "complete" as const } : e
        )
      )
      eventSource.close()
      onComplete?.()
    })

    eventSource.addEventListener("error", (event) => {
      let message = "Phase encountered an error"
      try {
        if (event instanceof MessageEvent && event.data) {
          const data = JSON.parse(event.data)
          message = data.message ?? message
        }
      } catch {
        // Use default message
      }

      entryCountRef.current += 1
      setEntries((prev) => [
        ...prev.map((e) =>
          e.status === "running" ? { ...e, status: "complete" as const } : e
        ),
        {
          id: String(entryCountRef.current),
          toolName: "Error",
          status: "error",
          message,
          timestamp: new Date(),
        },
      ])
      eventSource.close()
      onError?.()
    })

    eventSource.addEventListener("timeout", () => {
      eventSource.close()
    })

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [phaseId, onComplete, onError])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const completedCount = entries.filter((e) => e.status === "complete").length
  const totalCount = entries.length
  const computedProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isActive = entries.some((e) => e.status === "running")

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10", className)}>
      {/* Overall progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">
            {connected ? "Agent progress" : "Connecting..."}
          </span>
          {totalCount > 0 && <span>{completedCount}/{totalCount} steps</span>}
        </div>
        <div className="relative overflow-hidden rounded-full">
          <Progress value={isActive ? Math.max(computedProgress, 10) : computedProgress} />
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
        {entries.length === 0 && connected && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Waiting for agent to start...
          </div>
        )}
        {entries.map((entry) => {
          const Icon = ENTRY_ICONS[entry.status]
          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs animate-slide-in-left"
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
