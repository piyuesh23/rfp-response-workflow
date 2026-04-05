"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { ProgressStream } from "@/components/phase/ProgressStream"
import { PhaseGate } from "@/components/phase/PhaseGate"
import { QAResponseForm } from "@/components/phase/QAResponseForm"
import type { PhaseStatus } from "@/components/phase/PhaseCard"
import type { ArtefactVersion } from "@/components/phase/PhaseGate"

// ---------------------------------------------------------------------------
// Mock data — replace with real fetch when API is ready
// ---------------------------------------------------------------------------
const MOCK_PHASE_2: {
  status: PhaseStatus
  stats?: Record<string, string | number>
  versions?: ArtefactVersion[]
  selectedVersion?: number
} = {
  status: "PENDING",
}

interface Phase2PageProps {
  params: Promise<{ id: string }>
}

export default function Phase2Page({ params }: Phase2PageProps) {
  const { id } = React.use(params)
  const router = useRouter()

  const data = MOCK_PHASE_2

  // After the form is submitted we simulate a transition to RUNNING
  const [status, setStatus] = React.useState<PhaseStatus>(data.status)

  function handleSubmitted() {
    setStatus("RUNNING")
  }

  const title = (
    <div className="flex items-center gap-2">
      <h2 className="text-base font-semibold">Phase 2: Response Integration</h2>
      {status === "RUNNING" && (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
        >
          Running
        </Badge>
      )}
      {status === "REVIEW" && (
        <Badge
          variant="outline"
          className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs"
        >
          Review
        </Badge>
      )}
      {status === "APPROVED" && (
        <Badge
          variant="outline"
          className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs"
        >
          Approved
        </Badge>
      )}
      {status === "PENDING" && (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border text-xs"
        >
          Pending
        </Badge>
      )}
    </div>
  )

  if (status === "RUNNING") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <ProgressStream phaseId={id} />
      </div>
    )
  }

  if (status === "REVIEW" || status === "APPROVED") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <PhaseGate
          engagementId={id}
          phaseNumber="2"
          versions={data.versions}
          selectedVersion={data.selectedVersion}
          readOnly={status === "APPROVED"}
          onBack={() => router.push(`/engagements/${id}`)}
          onRequestRevision={() => {
            // trigger revision flow
          }}
          onApprove={() => {
            router.push(`/engagements/${id}`)
          }}
        />
      </div>
    )
  }

  // PENDING — show the Q&A response input form
  return (
    <div className="flex flex-col gap-6">
      {title}
      <QAResponseForm engagementId={id} onSubmitted={handleSubmitted} />
    </div>
  )
}
