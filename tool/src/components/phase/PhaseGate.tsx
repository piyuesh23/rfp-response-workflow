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
import { Maximize2, Minimize2, ChevronLeft, RotateCcw, CheckCircle2, GitCompareArrows, Send, FileText, FileSpreadsheet, FileCode, File, Folder, ArrowLeft, Loader2, TableProperties } from "lucide-react"
import { cn } from "@/lib/utils"
import { VersionSelector } from "@/components/artefact/VersionSelector"
import { ArtefactDiff } from "@/components/artefact/ArtefactDiff"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"
import { CsvViewer } from "@/components/artefact/CsvViewer"
import { TabbedEstimate } from "@/components/estimate/TabbedEstimate"
import { parseEstimateMarkdown } from "@/lib/estimate-parser"
import { ValidationPanel } from "@/components/phase/ValidationPanel"

export interface ArtefactVersion {
  version: number
  contentMd: string
  createdAt: string
}

interface FileEntry {
  key: string
  name: string
  dir: string
  ext: string
}

interface PhaseGateProps {
  children?: React.ReactNode
  phaseId?: string
  engagementId?: string
  phaseNumber?: string
  versions?: ArtefactVersion[]
  selectedVersion?: number
  onVersionChange?: (version: number) => void
  onBack?: () => void
  onRequestRevision?: (feedback: string) => void
  onApprove?: () => void
  approveMessage?: string | null
  readOnly?: boolean
  className?: string
}

const DIR_LABELS: Record<string, string> = {
  "research": "Research",
  "research/csv": "Research (CSV)",
  "initial_questions": "Clarifying Questions",
  "responses_qna": "Q&A Responses",
  "estimates": "Estimates",
  "claude-artefacts": "AI Artefacts",
}

const EXT_ICONS: Record<string, React.ReactNode> = {
  md: <FileText className="size-3.5 text-blue-500" />,
  csv: <FileSpreadsheet className="size-3.5 text-green-500" />,
  json: <FileCode className="size-3.5 text-amber-500" />,
  txt: <FileText className="size-3.5 text-muted-foreground" />,
}

function groupByDir(files: FileEntry[]): Record<string, FileEntry[]> {
  const groups: Record<string, FileEntry[]> = {}
  for (const f of files) {
    const dir = f.dir || "."
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(f)
  }
  return groups
}

export function PhaseGate({
  children,
  phaseId,
  engagementId,
  phaseNumber,
  versions,
  selectedVersion,
  onVersionChange,
  onBack,
  onRequestRevision,
  onApprove,
  approveMessage,
  readOnly = false,
  className,
}: PhaseGateProps) {
  const [fullscreen, setFullscreen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [revisionOpen, setRevisionOpen] = React.useState(false)
  const [revisionFeedback, setRevisionFeedback] = React.useState("")

  // Phase file browser state
  const [phaseFiles, setPhaseFiles] = React.useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null)
  const [fileContent, setFileContent] = React.useState<string | null>(null)
  const [fileExt, setFileExt] = React.useState<string>("")
  const [fileLoading, setFileLoading] = React.useState(false)

  // Estimate table editor toggle (for estimate phases 1A, 3)
  const isEstimatePhase = phaseNumber === "1A" || phaseNumber === "3"
  const [showEstimateEditor, setShowEstimateEditor] = React.useState(false)
  const [viewingFile, setViewingFile] = React.useState(false)

  // Fetch phase files
  React.useEffect(() => {
    if (!engagementId || !phaseNumber) return
    fetch(`/api/engagements/${engagementId}/phases/${phaseNumber}/files`)
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => setPhaseFiles(data.files ?? []))
      .catch(() => {})
  }, [engagementId, phaseNumber])

  const PREVIEWABLE_EXTS = new Set(["md", "csv", "txt", "json", "html"])

  function handleFileClick(file: FileEntry) {
    if (!engagementId) return

    // Non-previewable files: trigger direct download
    if (!PREVIEWABLE_EXTS.has(file.ext)) {
      const link = document.createElement("a")
      link.href = `/api/engagements/${engagementId}/files/${file.key}`
      link.download = file.name
      link.click()
      return
    }

    setSelectedFile(file.key)
    setFileExt(file.ext)
    setFileLoading(true)
    setViewingFile(true)

    fetch(`/api/engagements/${engagementId}/files/${file.key}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.previewable && data.content) {
          setFileContent(data.content)
        } else {
          setFileContent(null)
        }
      })
      .catch(() => setFileContent(null))
      .finally(() => setFileLoading(false))
  }

  function handleBackToArtefact() {
    setViewingFile(false)
    setSelectedFile(null)
    setFileContent(null)
  }

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
            <div className="flex items-center gap-1">
              {isEstimatePhase && hasVersions && !readOnly && (
                <Button
                  variant={showEstimateEditor ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowEstimateEditor((prev) => !prev)}
                  title={showEstimateEditor ? "Switch to markdown view" : "Edit estimate tables"}
                >
                  <TableProperties className="size-4" />
                  <span className="hidden sm:inline">{showEstimateEditor ? "Markdown" : "Edit Tables"}</span>
                </Button>
              )}
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
          </div>

          {/* Validation panel for estimate and proposal phases */}
          {phaseId && (phaseNumber === "1A" || phaseNumber === "3" || phaseNumber === "5") && !readOnly && (
            <ValidationPanel phaseId={phaseId} phaseNumber={phaseNumber} />
          )}

          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {viewingFile ? (
              fileLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : fileContent ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleBackToArtefact}>
                      <ArrowLeft className="size-4" />
                      Back to artefact
                    </Button>
                    <span className="text-xs text-muted-foreground truncate">{selectedFile}</span>
                  </div>
                  {fileExt === "md" ? (
                    <ArtefactViewer contentMd={fileContent} />
                  ) : fileExt === "csv" ? (
                    <CsvViewer content={fileContent} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto">
                      {fileExt === "json" ? JSON.stringify(JSON.parse(fileContent), null, 2) : fileContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12">
                  <p className="text-sm text-muted-foreground">File preview not available.</p>
                  <Button variant="ghost" size="sm" onClick={handleBackToArtefact}>
                    <ArrowLeft className="size-4" />
                    Back to artefact
                  </Button>
                </div>
              )
            ) : showEstimateEditor && activeVersionData?.contentMd ? (
              <div className="flex flex-col gap-4">
                <TabbedEstimate
                  initialData={parseEstimateMarkdown(activeVersionData.contentMd)}
                />
              </div>
            ) : activeVersionData ? (
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

        {/* Right panel: phase files (~40%) */}
        <div className="flex flex-col md:w-[30%] border-t md:border-t-0 md:border-l-0">
          <div className="border-b px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Files ({phaseFiles.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {phaseFiles.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-muted-foreground">No files generated yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 p-2">
                {/* Summary item — navigates back to main artefact */}
                {hasVersions && (
                  <button
                    type="button"
                    onClick={handleBackToArtefact}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors w-full mb-1",
                      !viewingFile
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span>Summary</span>
                  </button>
                )}
                {Object.entries(groupByDir(phaseFiles)).map(([dir, files]) => (
                  <div key={dir} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Folder className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {DIR_LABELS[dir] ?? dir}
                      </span>
                      <span className="text-xs text-muted-foreground/60 ml-auto">{files.length}</span>
                    </div>
                    {files.map((file) => (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => handleFileClick(file)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors w-full",
                          selectedFile === file.key
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50"
                        )}
                      >
                        {EXT_ICONS[file.ext] ?? <File className="size-3.5 text-muted-foreground" />}
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
            <Button size="sm" onClick={onApprove} disabled={!!approveMessage}>
              {approveMessage ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {approveMessage}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Approve &amp; Continue
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
