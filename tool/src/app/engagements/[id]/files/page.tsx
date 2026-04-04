"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"
import { CsvViewer } from "@/components/artefact/CsvViewer"
import { Button } from "@/components/ui/button"
import {
  Folder, FileText, FileSpreadsheet, File, Download,
  Loader2, ChevronRight, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FileEntry {
  key: string
  name: string
  dir: string
  ext: string
}

interface FilePreview {
  path: string
  ext: string
  content?: string
  downloadUrl?: string
  previewable: boolean
}

const DIR_LABELS: Record<string, string> = {
  tor: "TOR Documents",
  research: "Research",
  "research/csv": "Research (CSV)",
  initial_questions: "Clarifying Questions",
  responses_qna: "Q&A Responses",
  estimates: "Estimates",
  "claude-artefacts": "AI Artefacts",
}

const EXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  md: FileText,
  csv: FileSpreadsheet,
  txt: FileText,
  json: FileText,
}

function groupByDir(files: FileEntry[]): Record<string, FileEntry[]> {
  const groups: Record<string, FileEntry[]> = {}
  for (const file of files) {
    const dir = file.dir || "(root)"
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(file)
  }
  // Sort directories
  return Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  )
}

export default function FilesPage() {
  const { id } = useParams<{ id: string }>()
  const [files, setFiles] = React.useState<FileEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [preview, setPreview] = React.useState<FilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/engagements/${id}/files`)
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [id])

  async function handleFileClick(file: FileEntry) {
    const relativePath = file.dir ? `${file.dir}/${file.name}` : file.name
    setSelectedFile(relativePath)
    setPreviewLoading(true)
    setPreview(null)

    try {
      const res = await fetch(
        `/api/engagements/${id}/files/${relativePath}`
      )
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      }
    } catch {
      // Preview failed
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading files...
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Folder className="size-10 text-muted-foreground/40" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">No files yet</p>
          <p className="text-xs text-muted-foreground/70">
            Files will appear here as phases generate artefacts.
          </p>
        </div>
      </div>
    )
  }

  const grouped = groupByDir(files)

  return (
    <div className="flex flex-col gap-0 md:flex-row md:gap-0 min-h-[400px]">
      {/* Left: File tree */}
      <div
        className={cn(
          "flex flex-col border-r md:w-[280px] shrink-0 overflow-y-auto",
          preview && "hidden md:flex"
        )}
      >
        <div className="px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Files ({files.length})
          </span>
        </div>
        <div className="flex flex-col py-1">
          {Object.entries(grouped).map(([dir, dirFiles]) => (
            <div key={dir} className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Folder className="size-3.5" />
                {DIR_LABELS[dir] ?? dir}
                <span className="ml-auto text-muted-foreground/60">{dirFiles.length}</span>
              </div>
              {dirFiles.map((file) => {
                const relativePath = file.dir ? `${file.dir}/${file.name}` : file.name
                const isSelected = selectedFile === relativePath
                const Icon = EXT_ICONS[file.ext] ?? File
                return (
                  <button
                    key={file.key}
                    onClick={() => handleFileClick(file)}
                    className={cn(
                      "flex items-center gap-2 px-3 pl-7 py-1.5 text-xs text-left transition-colors",
                      "hover:bg-muted/50",
                      isSelected && "bg-muted text-foreground font-medium"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <ChevronRight className="size-3 ml-auto shrink-0 text-muted-foreground/40" />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Preview panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {previewLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading preview...
          </div>
        )}

        {!previewLoading && !preview && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center flex-1">
            <FileText className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Select a file to preview
            </p>
          </div>
        )}

        {!previewLoading && preview && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Preview header */}
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {preview.path}
              </span>
              <div className="flex items-center gap-1">
                {preview.downloadUrl && (
                  <a
                    href={preview.downloadUrl}
                    download
                    className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Download className="size-4" />
                  </a>
                )}
                {preview.previewable && preview.content && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const blob = new Blob([preview.content!], {
                        type: "text/plain;charset=utf-8",
                      })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = preview.path.split("/").pop() ?? "file"
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  onClick={() => { setPreview(null); setSelectedFile(null) }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-auto p-4">
              {preview.previewable && preview.content !== undefined ? (
                <>
                  {preview.ext === "md" && (
                    <ArtefactViewer contentMd={preview.content} />
                  )}
                  {preview.ext === "csv" && (
                    <CsvViewer content={preview.content} />
                  )}
                  {preview.ext === "json" && (
                    <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(preview.content), null, 2)
                        } catch {
                          return preview.content
                        }
                      })()}
                    </pre>
                  )}
                  {(preview.ext === "txt" || preview.ext === "html") && (
                    <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-auto whitespace-pre-wrap">
                      {preview.content}
                    </pre>
                  )}
                </>
              ) : preview.downloadUrl ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <File className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    This file type cannot be previewed.
                  </p>
                  <a
                    href={preview.downloadUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Download className="size-4" />
                    Download File
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
