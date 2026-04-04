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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Maximize2, Minimize2, ChevronLeft, RotateCcw, CheckCircle2, GitCompareArrows, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { VersionSelector } from "@/components/artefact/VersionSelector"
import { ArtefactDiff } from "@/components/artefact/ArtefactDiff"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"

export interface ArtefactVersion {
  version: number
  contentMd: string
  createdAt: string
}

interface PhaseGateProps {
  children?: React.ReactNode
  stats?: Record<string, string | number>
  versions?: ArtefactVersion[]
  selectedVersion?: number
  onVersionChange?: (version: number) => void
  onBack?: () => void
  onRequestRevision?: (feedback: string) => void
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
  const [revisionOpen, setRevisionOpen] = React.useState(false)
  const [revisionFeedback, setRevisionFeedback] = React.useState("")

  // Current version number shown in the viewer
  const versionNumbers = versions?.map((v) => v.version) ?? []
  const latestVersion = versionNumbers[versionNumbers.length - 1]
  const [activeVersion, setActiveVersion] = React.useState<number>(
    selectedVersion ?? latestVersion ?? 1
  )

  // Compare dialog state: left = older, right = newer
  const [compareLeft, setCompareLeft] = React.useState<number>(
    versionNumbers.length >= 2 ? versionNumbers[versionNumbers.length - 2] : versionNumbers[0] ?? 1
  )
  const [compareRight, setCompareRight] = React.useState<number>(
    latestVersion ?? 1
  )

  React.useEffect(() => {
    // Trigger scale-in on first mount (unlock / review entrance)
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Sync active version when selectedVersion prop changes
  React.useEffect(() => {
    if (selectedVersion !== undefined) {
      setActiveVersion(selectedVersion)
    }
  }, [selectedVersion])

  function handleVersionChange(v: number) {
    setActiveVersion(v)
    onVersionChange?.(v)
  }

  const activeVersionData = versions?.find((v) => v.version === activeVersion)
  const compareLeftData = versions?.find((v) => v.version === compareLeft)
  const compareRightData = versions?.find((v) => v.version === compareRight)

  const hasVersions = versions && versions.length > 0
  const hasMultipleVersions = versions && versions.length > 1

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
              {hasVersions && (
                <VersionSelector
                  versions={versionNumbers}
                  currentVersion={activeVersion}
                  onChange={handleVersionChange}
                />
              )}
              {hasMultipleVersions && (
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" size="sm" title="Compare versions">
                        <GitCompareArrows className="size-4" />
                        <span className="hidden sm:inline">Compare</span>
                      </Button>
                    }
                  />
                  <DialogContent
                    className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden"
                    showCloseButton
                  >
                    <DialogHeader>
                      <DialogTitle>Compare Versions</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-3 border-b pb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground shrink-0">From</span>
                        <Select
                          value={String(compareLeft)}
                          onValueChange={(v) => setCompareLeft(Number(v))}
                        >
                          <SelectTrigger size="sm" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {versionNumbers.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                v{v}
                                {versions?.find((vd) => vd.version === v)?.createdAt
                                  ? ` — ${versions.find((vd) => vd.version === v)!.createdAt}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground shrink-0">To</span>
                        <Select
                          value={String(compareRight)}
                          onValueChange={(v) => setCompareRight(Number(v))}
                        >
                          <SelectTrigger size="sm" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {versionNumbers.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                v{v}
                                {versions?.find((vd) => vd.version === v)?.createdAt
                                  ? ` — ${versions.find((vd) => vd.version === v)!.createdAt}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {compareLeftData && compareRightData ? (
                        <ArtefactDiff
                          oldContent={compareLeftData.contentMd}
                          newContent={compareRightData.contentMd}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground p-4">
                          Select two versions to compare.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
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
            {activeVersionData ? (
              <ArtefactViewer
                contentMd={activeVersionData.contentMd}
                version={activeVersionData.version}
              />
            ) : (
              children
            )}
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
            <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <RotateCcw className="size-4" />
                    Request Revision
                  </Button>
                }
              />
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Request Revision</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Describe what should be changed. This feedback will be included when the phase re-runs.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="revision-feedback">Feedback</Label>
                    <Textarea
                      id="revision-feedback"
                      placeholder="e.g., Missing integration estimates for payment gateway. The search implementation should use Solr, not Elasticsearch..."
                      value={revisionFeedback}
                      onChange={(e) => setRevisionFeedback(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setRevisionOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={revisionFeedback.trim().length < 10}
                      onClick={() => {
                        onRequestRevision?.(revisionFeedback.trim())
                        setRevisionFeedback("")
                        setRevisionOpen(false)
                      }}
                    >
                      <Send className="size-4" />
                      Submit &amp; Re-run
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
