"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Maximize2, Minimize2, ChevronLeft, RotateCcw, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhaseGateProps {
  children: React.ReactNode
  stats?: Record<string, string | number>
  versions?: number[]
  selectedVersion?: number
  onVersionChange?: (version: number) => void
  onBack?: () => void
  onRequestRevision?: () => void
  onApprove?: () => void
  readOnly?: boolean
  className?: string
}

export function PhaseGate({
  children,
  stats,
  versions,
  selectedVersion,
  onVersionChange,
  onBack,
  onRequestRevision,
  onApprove,
  readOnly = false,
  className,
}: PhaseGateProps) {
  const [fullscreen, setFullscreen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // Trigger scale-in on first mount (unlock / review entrance)
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={cn(
        "flex flex-col gap-0 overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10",
        !mounted && "opacity-0",
        mounted && "animate-scale-in",
        className
      )}
    >
      {/* Main content area */}
      <div
        className={cn(
          "flex flex-col md:flex-row",
          fullscreen && "fixed inset-0 z-50 bg-background flex flex-col md:flex-row"
        )}
      >
        {/* Left panel: artefact content (~60%) */}
        <div className={cn("flex flex-col flex-1 min-h-0 md:w-[60%]", fullscreen && "md:w-[60%]")}>
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <div className="flex items-center gap-2">
              {versions && versions.length > 1 && (
                <Select
                  value={selectedVersion !== undefined ? String(selectedVersion) : undefined}
                  onValueChange={(v) => onVersionChange?.(Number(v))}
                >
                  <SelectTrigger size="sm" className="w-28">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        v{v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullscreen((prev) => !prev)}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {children}
          </div>
        </div>

        {/* Vertical separator on desktop */}
        <Separator orientation="vertical" className="hidden md:block" />

        {/* Right panel: summary stats (~40%) */}
        {stats && (
          <div className="flex flex-col md:w-[40%] border-t md:border-t-0 md:border-l-0">
            <div className="border-b px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Summary
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <dl className="flex flex-col gap-3">
                {Object.entries(stats).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2">
                    <dt className="text-xs text-muted-foreground shrink-0">{key}</dt>
                    <dd className="text-xs font-medium text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions bar */}
      <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-4 py-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" />
          Back
        </Button>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRequestRevision}>
              <RotateCcw className="size-4" />
              Request Revision
            </Button>
            <Button size="sm" onClick={onApprove}>
              <CheckCircle2 className="size-4" />
              Approve &amp; Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
