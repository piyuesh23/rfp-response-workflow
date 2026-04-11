"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ProgressStream } from "@/components/phase/ProgressStream"
import { PhaseGate } from "@/components/phase/PhaseGate"
import type { ArtefactVersion } from "@/components/phase/PhaseGate"
import { RunPhaseButton } from "@/components/phase/RunPhaseButton"
import { PHASE_LABELS } from "@/components/phase/PhaseCard"
import type { PhaseStatus } from "@/components/phase/PhaseCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, SkipForward } from "lucide-react"
import { getPhaseDef } from "@/lib/phase-chain"
import { usePhaseNotifications } from "@/hooks/usePhaseNotifications"

interface PhaseArtefact {
  id: string
  artefactType: string
  version: number
  label?: string | null
  contentMd: string
  fileUrl?: string | null
  metadata?: unknown
  createdAt: string
}

interface PhaseData {
  id: string
  phaseNumber: string
  status: PhaseStatus
  startedAt?: string | null
  completedAt?: string | null
  artefacts: PhaseArtefact[]
}

interface PhaseDetailPageProps {
  params: Promise<{ id: string; phase: string }>
}

// Phases that support file upload
const UPLOAD_PHASES: Record<string, { accept: string; label: string; description: string; s3Prefix: string }> = {
  "1A": {
    accept: ".xlsx,.xls,.csv,.md",
    label: "Upload Estimate Sheet",
    description: "Upload an existing estimate spreadsheet instead of AI-generating one.",
    s3Prefix: "estimates",
  },
  "2": {
    accept: ".pdf,.doc,.docx,.md,.txt,.xlsx",
    label: "Upload Q&A Responses",
    description: "Upload the customer's responses to clarifying questions.",
    s3Prefix: "responses_qna",
  },
  "3": {
    accept: ".xlsx,.xls,.csv,.md",
    label: "Upload Estimate Sheet",
    description: "Upload the estimate spreadsheet for review and gap analysis.",
    s3Prefix: "estimates",
  },
}

export default function PhaseDetailPage({ params }: PhaseDetailPageProps) {
  const { id, phase } = React.use(params)
  const router = useRouter()
  const [phaseData, setPhaseData] = React.useState<PhaseData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [approveMessage, setApproveMessage] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchPhaseData = React.useCallback(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.phases) {
          const matched = data.phases.find(
            (p: PhaseData) => p.phaseNumber === phase
          )
          setPhaseData(matched ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, phase])

  React.useEffect(() => {
    fetchPhaseData()
  }, [fetchPhaseData])

  const label = PHASE_LABELS[phase] ?? `Phase ${phase}`
  const phaseDef = getPhaseDef(phase)
  const uploadConfig = UPLOAD_PHASES[phase]

  // Browser notifications when phase completes while user has tabbed away
  usePhaseNotifications({
    phaseId: phaseData?.status === "RUNNING" ? phaseData.id : null,
    engagementId: id,
    phaseNumber: phase,
    phaseLabel: label,
    enabled: phaseData?.status === "RUNNING",
    onComplete: fetchPhaseData,
    onError: fetchPhaseData,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading phase...
      </div>
    )
  }

  if (!phaseData) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
        <p className="text-sm text-muted-foreground">Phase data not found.</p>
      </div>
    )
  }

  const status = phaseData.status

  // Convert artefacts to ArtefactVersion[]
  const versions: ArtefactVersion[] = phaseData.artefacts
    .sort((a, b) => a.version - b.version)
    .map((a) => ({
      id: a.id,
      version: a.version,
      label: a.label,
      contentMd: a.contentMd,
      createdAt: new Date(a.createdAt).toLocaleDateString(),
    }))

  const latestArtefact = phaseData.artefacts.length > 0
    ? phaseData.artefacts.reduce((latest, a) => a.version > latest.version ? a : latest, phaseData.artefacts[0])
    : null
  // engagementId and phase are passed to PhaseGate for its file browser sidebar

  // Phases that trigger template population on approval (takes longer)
  const TEMPLATE_PHASES = new Set(["1", "1A", "3"])

  async function handleApprove() {
    if (!phaseData) return
    setActionLoading(true)

    if (TEMPLATE_PHASES.has(phase)) {
      setApproveMessage("Approving and populating Presales Sheet...")
    } else {
      setApproveMessage("Approving...")
    }

    try {
      const res = await fetch(`/api/phases/${phaseData.id}/approve`, { method: "POST" })
      if (res.ok) {
        setApproveMessage(null)
        router.push(`/engagements/${id}`)
      } else {
        const err = await res.json()
        console.error("Approve failed:", err.error)
        setApproveMessage(null)
      }
    } catch (err) {
      console.error("Approve failed:", err)
      setApproveMessage(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRevision(feedback: string) {
    if (!phaseData) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/phases/${phaseData.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      })
      if (res.ok) {
        router.push(`/engagements/${id}`)
      } else {
        const err = await res.json()
        console.error("Revision failed:", err.error)
      }
    } catch (err) {
      console.error("Revision failed:", err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRun() {
    if (!phaseData) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/phases/${phaseData.id}/run`, { method: "POST" })
      if (res.ok) {
        fetchPhaseData()
      } else {
        const err = await res.json()
        console.error("Run failed:", err.error)
      }
    } catch (err) {
      console.error("Run failed:", err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSkip() {
    if (!phaseData) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/phases/${phaseData.id}/skip`, { method: "POST" })
      if (res.ok) {
        router.push(`/engagements/${id}`)
      } else {
        const err = await res.json()
        console.error("Skip failed:", err.error)
      }
    } catch (err) {
      console.error("Skip failed:", err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0 || !phaseData) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("engagementId", id)
      formData.append("prefix", uploadConfig?.s3Prefix ?? "uploads")
      for (const file of Array.from(files)) {
        formData.append("file", file)
      }

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        console.error("Upload failed")
        return
      }

      // For Phase 2: auto-set workflow path to HAS_RESPONSE before running
      if (phase === "2") {
        await fetch(`/api/engagements/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowPath: "HAS_RESPONSE" }),
        })
      }

      // After upload, run the phase to process the uploaded files
      await handleRun()
    } catch (err) {
      console.error("Upload failed:", err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // --- Render by status ---

  if (status === "RUNNING") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
            Running
          </Badge>
        </div>
        <ProgressStream
          phaseId={phaseData.id}
          onComplete={() => fetchPhaseData()}
          onError={() => fetchPhaseData()}
        />
      </div>
    )
  }

  if (status === "REVIEW") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
            Review
          </Badge>
          {versions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </Badge>
          )}
        </div>
        {versions.length > 0 ? (
          <PhaseGate
            phaseId={phaseData.id}
            engagementId={id}
            phaseNumber={phase}
            versions={versions}
            selectedVersion={versions[versions.length - 1]?.version}
            onBack={() => router.push(`/engagements/${id}`)}
            onRequestRevision={handleRevision}
            onApprove={handleApprove}
            onSaved={fetchPhaseData}
            approveMessage={approveMessage}
          />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Phase is in review but no artefacts were generated yet.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (status === "APPROVED") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">
            Approved
          </Badge>
          {versions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </Badge>
          )}
        </div>
        {versions.length > 0 ? (
          <PhaseGate
            phaseId={phaseData.id}
            engagementId={id}
            phaseNumber={phase}
            versions={versions}
            selectedVersion={versions[versions.length - 1]?.version}
            readOnly
            onBack={() => router.push(`/engagements/${id}`)}
          />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Phase approved with no artefacts.</p>
          </div>
        )}
      </div>
    )
  }

  if (status === "SKIPPED") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 text-xs">
            Skipped
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">This phase was skipped.</p>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/engagements/${id}`)}>
          Back to overview
        </Button>
      </div>
    )
  }

  // PENDING or FAILED
  const descriptions: Record<string, string> = {
    "0": "Run customer & site research based on the TOR document.",
    "1": "Analyse the TOR and generate clarifying questions.",
    "1A": "Generate optimistic estimates based on assumptions, or upload an existing estimate sheet.",
    "2": "Upload customer Q&A responses, then run analysis against the TOR and original questions.",
    "3": "Upload the estimate sheet for review, or generate one from the Q&A analysis.",
    "3R": "AI reviews the estimate against TOR + Q&A responses. Produces gap analysis and revised estimate.",
    "5": "Generate a client-facing technical proposal based on all prior analysis and estimates.",
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Phase {phase}: {label}</h2>
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">
          {status === "FAILED" ? "Failed" : "Pending"}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground max-w-prose">
        {descriptions[phase] ?? "No description available for this phase."}
      </p>

      {/* Hidden file input for upload */}
      {uploadConfig && (
        <input
          ref={fileInputRef}
          type="file"
          accept={uploadConfig.accept}
          className="hidden"
          onChange={handleFileUpload}
          multiple
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Upload button for phases that support it */}
        {uploadConfig && (
          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Uploading..." : uploadConfig.label}
          </Button>
        )}

        {/* Run AI agent button */}
        <RunPhaseButton
          phaseNumber={phase}
          disabled={actionLoading || uploading}
          onConfirm={handleRun}
        />

        {/* Skip button for optional phases */}
        {phaseDef?.optional && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={actionLoading}
            onClick={handleSkip}
          >
            <SkipForward className="size-4" />
            Skip this phase
          </Button>
        )}
      </div>
    </div>
  )
}
