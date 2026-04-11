"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Upload, X, FileText, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { requestNotificationPermission } from "@/hooks/usePhaseNotifications"

// ---------------------------------------------------------------------------
// Mock Phase 1 questions (grouped by category)
// ---------------------------------------------------------------------------
interface MockQuestion {
  id: string
  category: string
  question: string
}

const MOCK_QUESTIONS: MockQuestion[] = [
  {
    id: "q1",
    category: "Content Architecture",
    question:
      "How many distinct content types are required (e.g. news, blog, events, landing pages, product pages)? Please list all intended content types with a brief description of each.",
  },
  {
    id: "q2",
    category: "Content Architecture",
    question:
      "Will any content types require multi-language or localisation support? If so, which languages and what is the expected translation workflow?",
  },
  {
    id: "q3",
    category: "Integrations",
    question:
      "Which CRM system is currently in use (e.g. Salesforce, HubSpot, MS Dynamics)? What data needs to be synchronised and in which direction (push, pull, or bi-directional)?",
  },
  {
    id: "q4",
    category: "Integrations",
    question:
      "Is a single-sign-on (SSO) solution required? If so, which identity provider (IdP) will be used (e.g. Azure AD, Okta, Auth0)?",
  },
  {
    id: "q5",
    category: "Integrations",
    question:
      "Are there any payment gateway integrations required? If yes, which provider(s) and will the platform need to handle recurring billing or one-time payments?",
  },
  {
    id: "q6",
    category: "Migration",
    question:
      "How much content exists in the current system? Please provide an approximate count of nodes/pages, media assets, and any structured data (e.g. taxonomy terms, users).",
  },
  {
    id: "q7",
    category: "Migration",
    question:
      "Are URL redirects required for migrated content? Is there an existing redirect map or will one need to be generated as part of the migration?",
  },
  {
    id: "q8",
    category: "Frontend / Theming",
    question:
      "Will approved designs (Figma, Zeplin, or similar) be provided before development begins, or should estimates assume design creation as part of scope?",
  },
  {
    id: "q9",
    category: "Frontend / Theming",
    question:
      "Is there an existing design system or component library to be adopted? If not, should a new one be created as part of this engagement?",
  },
  {
    id: "q10",
    category: "DevOps / Hosting",
    question:
      "What is the preferred hosting environment (e.g. Acquia, Pantheon, AWS, Azure, on-premise)? Are there existing CI/CD pipelines that need to be integrated or replaced?",
  },
]

// Group questions by category
function groupByCategory(questions: MockQuestion[]): Record<string, MockQuestion[]> {
  return questions.reduce<Record<string, MockQuestion[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})
}

// ---------------------------------------------------------------------------
// Upload Mode
// ---------------------------------------------------------------------------
interface UploadModeProps {
  onSubmit: (file: File) => void
  submitting: boolean
}

const ACCEPTED_TYPES = [".pdf", ".docx", ".md"]

function UploadMode({ onSubmit, submitting }: UploadModeProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setFile(files[0])
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleRemove() {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleSubmit() {
    if (file) onSubmit(file)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Q&A response document"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed",
          "p-10 text-center transition-colors cursor-pointer select-none",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <Upload className={cn("size-8 text-muted-foreground", dragging && "text-primary")} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            Drag &amp; drop your file here, or{" "}
            <span className="text-primary underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Accepted formats: PDF, DOCX, MD — max 20 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Selected file */}
      {file && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium truncate">{file.name}</span>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {(file.size / 1024).toFixed(0)} KB
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            aria-label="Remove file"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <Button
        disabled={!file || submitting}
        onClick={handleSubmit}
        className="self-start"
      >
        {submitting ? "Submitting…" : "Submit Responses"}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Mode
// ---------------------------------------------------------------------------
interface InlineModeProps {
  onSubmit: (responses: Record<string, string>) => void
  submitting: boolean
}

function InlineMode({ onSubmit, submitting }: InlineModeProps) {
  const [responses, setResponses] = React.useState<Record<string, string>>({})
  const [naItems, setNaItems] = React.useState<Set<string>>(new Set())

  const grouped = React.useMemo(() => groupByCategory(MOCK_QUESTIONS), [])

  function setResponse(id: string, value: string) {
    setResponses((prev) => ({ ...prev, [id]: value }))
  }

  function toggleNa(id: string) {
    setNaItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Clear any existing text response when marking N/A
        setResponses((r) => {
          const updated = { ...r }
          delete updated[id]
          return updated
        })
      }
      return next
    })
  }

  const answeredCount = MOCK_QUESTIONS.filter(
    (q) => naItems.has(q.id) || (responses[q.id] ?? "").trim().length > 0
  ).length

  const totalCount = MOCK_QUESTIONS.length
  const progressPct = Math.round((answeredCount / totalCount) * 100)
  const canSubmit = answeredCount > 0

  function handleSubmit() {
    const payload: Record<string, string> = {}
    for (const q of MOCK_QUESTIONS) {
      if (naItems.has(q.id)) {
        payload[q.id] = "N/A"
      } else if ((responses[q.id] ?? "").trim()) {
        payload[q.id] = responses[q.id].trim()
      }
    }
    onSubmit(payload)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {answeredCount} of {totalCount} questions answered
        </span>
      </div>

      {/* Questions grouped by category */}
      {Object.entries(grouped).map(([category, questions], catIdx) => (
        <div key={category} className="flex flex-col gap-4">
          {catIdx > 0 && <Separator />}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {category}
          </h3>
          {questions.map((q, qIdx) => {
            const isNa = naItems.has(q.id)
            const answered =
              isNa || (responses[q.id] ?? "").trim().length > 0

            return (
              <div key={q.id} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0 transition-colors",
                      answered ? "text-green-500" : "text-muted-foreground/30"
                    )}
                  />
                  <Label className="text-sm leading-relaxed font-normal cursor-default">
                    <span className="text-muted-foreground font-mono text-xs mr-1.5">
                      Q{qIdx + 1}.
                    </span>
                    {q.question}
                  </Label>
                </div>

                <div className="ml-5 flex flex-col gap-2">
                  <Textarea
                    placeholder="Enter customer's response…"
                    value={isNa ? "" : (responses[q.id] ?? "")}
                    onChange={(e) => setResponse(q.id, e.target.value)}
                    disabled={isNa}
                    rows={3}
                    className={cn(
                      "resize-none text-sm",
                      isNa && "opacity-40 cursor-not-allowed"
                    )}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={isNa}
                      onChange={() => toggleNa(q.id)}
                      className="rounded border-border accent-primary"
                    />
                    Mark as N/A
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <Separator />

      <Button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        className="self-start"
      >
        {submitting ? "Submitting…" : "Submit All Responses"}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QAResponseForm — public export
// ---------------------------------------------------------------------------
export interface QAResponseFormProps {
  engagementId: string
  phaseId: string
  onSubmitted?: () => void
}

export function QAResponseForm({ engagementId, phaseId, onSubmitted }: QAResponseFormProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleUploadSubmit(file: File) {
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("engagementId", engagementId)
      formData.append("prefix", "responses_qna")
      formData.append("file", file)

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Upload failed")
      }

      requestNotificationPermission()

      const runRes = await fetch(`/api/phases/${phaseId}/run`, { method: "POST" })
      if (!runRes.ok) {
        const body = await runRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Failed to start analysis")
      }

      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleInlineSubmit(responses: Record<string, string>) {
    setError(null)
    setSubmitting(true)
    try {
      // Serialise inline responses to a markdown file and upload
      const lines: string[] = ["# Customer Q&A Responses\n"]
      for (const q of MOCK_QUESTIONS) {
        lines.push(`## ${q.category}: ${q.question}\n`)
        lines.push(`${responses[q.id] ?? "N/A"}\n`)
      }
      const content = lines.join("\n")
      const blob = new Blob([content], { type: "text/markdown" })
      const file = new File([blob], "qa-responses.md", { type: "text/markdown" })
      await handleUploadSubmit(file)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 ring-1 ring-foreground/10">
      {/* Header instructions */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Customer Q&amp;A Responses</h3>
        <p className="text-sm text-muted-foreground max-w-prose">
          Provide the customer&apos;s responses to the clarifying questions generated in Phase 1.
          You can either upload a response document or answer each question inline.
        </p>
      </div>

      <Separator />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
          {error}
        </p>
      )}

      <Tabs defaultValue="upload">
        <TabsList className="mb-2">
          <TabsTrigger value="upload">Upload Document</TabsTrigger>
          <TabsTrigger value="inline">Answer Inline</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0">
          <UploadMode onSubmit={handleUploadSubmit} submitting={submitting} />
        </TabsContent>

        <TabsContent value="inline" className="mt-0">
          <InlineMode onSubmit={handleInlineSubmit} submitting={submitting} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
