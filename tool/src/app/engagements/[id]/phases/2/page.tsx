"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { ProgressStream } from "@/components/phase/ProgressStream"
import { PhaseGate } from "@/components/phase/PhaseGate"
import { QAResponseForm } from "@/components/phase/QAResponseForm"
import type { PhaseStatus } from "@/components/phase/PhaseCard"
import type { ArtefactVersion } from "@/components/phase/PhaseGate"
import { usePhaseNotifications } from "@/hooks/usePhaseNotifications"

interface PhaseArtefact {
  id: string
  version: number
  contentMd: string
  createdAt: string
}

interface PhaseData {
  id: string
  phaseNumber: string
  status: PhaseStatus
  artefacts: PhaseArtefact[]
}

interface EngagementResponse {
  phases?: PhaseData[]
}

interface Phase2PageProps {
  params: Promise<{ id: string }>
}

export default function Phase2Page({ params }: Phase2PageProps) {
  const { id } = React.use(params)
  const router = useRouter()
  const [phaseData, setPhaseData] = React.useState<PhaseData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [approveMessage, setApproveMessage] = React.useState<string | null>(null)

  const fetchPhaseData = React.useCallback(() => {
    setLoading(true)
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EngagementResponse | null) => {
        const matched = data?.phases?.find((phase) => phase.phaseNumber === "2") ?? null
        setPhaseData(matched)
      })
      .catch(() => {
        setPhaseData(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => {
    fetchPhaseData()
  }, [fetchPhaseData])

  async function handleApprove() {
    if (!phaseData) return
    setApproveMessage("Approving...")
    try {
      const res = await fetch(`/api/phases/${phaseData.id}/approve`, { method: "POST" })
      if (res.ok) {
        router.push(`/engagements/${id}`)
      }
    } finally {
      setApproveMessage(null)
    }
  }

  async function handleRevision(feedback: string) {
    if (!phaseData) return
    const res = await fetch(`/api/phases/${phaseData.id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    })

    if (res.ok) {
      fetchPhaseData()
    }
  }

  usePhaseNotifications({
    phaseId: phaseData?.status === "RUNNING" ? phaseData.id : null,
    engagementId: id,
    phaseNumber: "2",
    phaseLabel: "Response Integration",
    enabled: phaseData?.status === "RUNNING",
    onComplete: fetchPhaseData,
    onError: fetchPhaseData,
  })

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading phase...
      </div>
    )
  }

  if (!phaseData) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Phase 2: Response Integration</h2>
        <p className="text-sm text-muted-foreground">Phase data not found.</p>
      </div>
    )
  }

  const versions: ArtefactVersion[] = phaseData.artefacts
    .sort((a, b) => a.version - b.version)
    .map((artefact) => ({
      version: artefact.version,
      contentMd: artefact.contentMd,
      createdAt: new Date(artefact.createdAt).toLocaleDateString(),
    }))

  const title = (
    <div className="flex items-center gap-2">
      <h2 className="text-base font-semibold">Phase 2: Response Integration</h2>
      {phaseData.status === "RUNNING" && (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
        >
          Running
        </Badge>
      )}
      {phaseData.status === "REVIEW" && (
        <Badge
          variant="outline"
          className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs"
        >
          Review
        </Badge>
      )}
      {phaseData.status === "APPROVED" && (
        <Badge
          variant="outline"
          className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs"
        >
          Approved
        </Badge>
      )}
      {(phaseData.status === "PENDING" || phaseData.status === "FAILED") && (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border text-xs"
        >
          {phaseData.status === "FAILED" ? "Failed" : "Pending"}
        </Badge>
      )}
    </div>
  )

  if (phaseData.status === "RUNNING") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <ProgressStream
          phaseId={phaseData.id}
          onComplete={fetchPhaseData}
          onError={fetchPhaseData}
        />
      </div>
    )
  }

  if (phaseData.status === "REVIEW" || phaseData.status === "APPROVED") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <PhaseGate
          engagementId={id}
          phaseNumber="2"
          versions={versions}
          selectedVersion={versions[versions.length - 1]?.version}
          readOnly={phaseData.status === "APPROVED"}
          onBack={() => router.push(`/engagements/${id}`)}
          onRequestRevision={handleRevision}
          onApprove={handleApprove}
          approveMessage={approveMessage}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {title}
      <QAResponseForm
        engagementId={id}
        phaseId={phaseData.id}
        onSubmitted={fetchPhaseData}
      />
    </div>
  )
}
