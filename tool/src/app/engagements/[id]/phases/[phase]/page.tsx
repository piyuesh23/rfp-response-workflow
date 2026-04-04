"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ProgressStream } from "@/components/phase/ProgressStream"
import { PhaseGate } from "@/components/phase/PhaseGate"
import { RunPhaseButton } from "@/components/phase/RunPhaseButton"
import { PHASE_LABELS } from "@/components/phase/PhaseCard"
import type { PhaseStatus } from "@/components/phase/PhaseCard"
import { Badge } from "@/components/ui/badge"

// Mock per-phase data — replace with real fetch when API is ready
const MOCK_PHASE_DATA: Record<
  string,
  {
    status: PhaseStatus
    artefactContent?: string
    stats?: Record<string, string | number>
    versions?: number[]
    selectedVersion?: number
    description?: string
  }
> = {
  "0": {
    status: "APPROVED",
    artefactContent: "## Customer Research\n\nResearch artefact content goes here.",
    stats: { "Pages Discovered": 120, "Integrations Found": 8, "Tech Stack": "Drupal 10" },
    versions: [1, 2],
    selectedVersion: 2,
  },
  "1": {
    status: "APPROVED",
    artefactContent: "## TOR Assessment\n\nTOR analysis artefact content goes here.",
    stats: { "Requirements": 42, "Clear": 28, "Needs Clarification": 10, "Ambiguous": 4 },
    versions: [1],
    selectedVersion: 1,
  },
  "1A": {
    status: "REVIEW",
    artefactContent: "## Optimistic Estimate\n\nEstimate artefact content goes here.",
    stats: { "Backend Low": "240h", "Backend High": "320h", "Frontend Low": "180h", "Frontend High": "240h" },
    versions: [1, 2, 3],
    selectedVersion: 3,
  },
  "2": {
    status: "PENDING",
    description:
      "Upload customer Q&A responses to `responses_qna/`, then run this phase to analyse them against the original TOR and clarifying questions.",
  },
  "3": {
    status: "PENDING",
    description:
      "Requires Phase 2 (Responses) to be approved before running estimate review.",
  },
  "4": {
    status: "PENDING",
    description:
      "Requires Phase 3 (Review) to be approved before generating gap analysis.",
  },
  "5": {
    status: "PENDING",
    description:
      "Run after engagement concludes or estimate is accepted to capture learnings.",
  },
}

// Simulate a running phase for demo purposes
const RUNNING_MOCK = {
  status: "RUNNING" as PhaseStatus,
  description: "AI agent is currently running this phase…",
}

interface PhaseDetailPageProps {
  params: Promise<{ id: string; phase: string }>
}

export default function PhaseDetailPage({ params }: PhaseDetailPageProps) {
  const { id, phase } = React.use(params)
  const router = useRouter()

  const data = MOCK_PHASE_DATA[phase] ?? {
    status: "PENDING" as PhaseStatus,
    description: "No data available for this phase.",
  }

  const label = PHASE_LABELS[phase] ?? `Phase ${phase}`

  if (data.status === "RUNNING") {
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
        <ProgressStream phaseId={id} />
      </div>
    )
  }

  if (data.status === "REVIEW") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
            Review
          </Badge>
        </div>
        <PhaseGate
          stats={data.stats}
          versions={data.versions}
          selectedVersion={data.selectedVersion}
          onBack={() => router.push(`/engagements/${id}`)}
          onRequestRevision={() => {
            // trigger revision flow
          }}
          onApprove={() => {
            router.push(`/engagements/${id}`)
          }}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{data.artefactContent}</pre>
          </div>
        </PhaseGate>
      </div>
    )
  }

  if (data.status === "APPROVED") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">
            Approved
          </Badge>
        </div>
        <PhaseGate
          stats={data.stats}
          versions={data.versions}
          selectedVersion={data.selectedVersion}
          readOnly
          onBack={() => router.push(`/engagements/${id}`)}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{data.artefactContent}</pre>
          </div>
        </PhaseGate>
      </div>
    )
  }

  // PENDING (or FAILED / SKIPPED)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">
          Phase {phase}: {label}
        </h2>
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">
          {data.status === "FAILED" ? "Failed" : data.status === "SKIPPED" ? "Skipped" : "Pending"}
        </Badge>
      </div>

      {data.description && (
        <p className="text-sm text-muted-foreground max-w-prose">{data.description}</p>
      )}

      <RunPhaseButton
        phaseNumber={phase}
        disabled={data.status === "SKIPPED"}
        onConfirm={() => {
          // trigger phase run
        }}
      />
    </div>
  )
}

// Export running mock for Storybook / dev usage
export { RUNNING_MOCK }
