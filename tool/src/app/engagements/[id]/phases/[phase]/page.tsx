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
import { Loader2 } from "lucide-react"

interface PhaseArtefact {
  id: string
  artefactType: string
  version: number
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

export default function PhaseDetailPage({ params }: PhaseDetailPageProps) {
  const { id, phase } = React.use(params)
  const router = useRouter()
  const [phaseData, setPhaseData] = React.useState<PhaseData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

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
        <h2 className="text-base font-semibold">
          Phase {phase}: {label}
        </h2>
        <p className="text-sm text-muted-foreground">Phase data not found.</p>
      </div>
    )
  }

  const status = phaseData.status

  // Convert artefacts to ArtefactVersion[] for PhaseGate
  const versions: ArtefactVersion[] = phaseData.artefacts
    .sort((a, b) => a.version - b.version)
    .map((a) => ({
      version: a.version,
      contentMd: a.contentMd,
      createdAt: new Date(a.createdAt).toLocaleDateString(),
    }))

  // Build stats from artefact metadata if available
  const latestArtefact = phaseData.artefacts.length > 0
    ? phaseData.artefacts.reduce((latest, a) => a.version > latest.version ? a : latest, phaseData.artefacts[0])
    : null
  const stats: Record<string, string | number> | undefined =
    latestArtefact?.metadata && typeof latestArtefact.metadata === "object"
      ? (latestArtefact.metadata as Record<string, string | number>)
      : undefined

  async function handleApprove() {
    if (!phaseData) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/phases/${phaseData.id}/approve`, {
        method: "POST",
      })
      if (res.ok) {
        router.push(`/engagements/${id}`)
      } else {
        const err = await res.json()
        console.error("Approve failed:", err.error)
      }
    } catch (err) {
      console.error("Approve failed:", err)
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
      const res = await fetch(`/api/phases/${phaseData.id}/run`, {
        method: "POST",
      })
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

  if (status === "RUNNING") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
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
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
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
            stats={stats}
            versions={versions}
            selectedVersion={versions[versions.length - 1]?.version}
            onBack={() => router.push(`/engagements/${id}`)}
            onRequestRevision={handleRevision}
            onApprove={handleApprove}
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
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
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
            stats={stats}
            versions={versions}
            selectedVersion={versions[versions.length - 1]?.version}
            readOnly
            onBack={() => router.push(`/engagements/${id}`)}
          />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Phase was approved but has no artefacts to display.
            </p>
          </div>
        )}
      </div>
    )
  }

  // PENDING, FAILED, SKIPPED
  const descriptions: Record<string, string> = {
    "0": "Run customer & site research based on the TOR document.",
    "1": "Analyse the TOR and generate clarifying questions.",
    "1A": "Generate optimistic estimates without customer Q&A responses.",
    "2": "Upload customer Q&A responses to responses_qna/, then run this phase to analyse them.",
    "3": "Review estimates against requirements and customer responses.",
    "4": "Generate gap analysis and revised estimates.",
    "5": "Capture learnings after the engagement concludes.",
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">
          Phase {phase}: {label}
        </h2>
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">
          {status === "FAILED" ? "Failed" : status === "SKIPPED" ? "Skipped" : "Pending"}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground max-w-prose">
        {descriptions[phase] ?? "No description available for this phase."}
      </p>

      <RunPhaseButton
        phaseNumber={phase}
        disabled={status === "SKIPPED" || actionLoading}
        onConfirm={handleRun}
      />
    </div>
  )
}
