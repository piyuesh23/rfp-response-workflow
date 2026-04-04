import * as React from "react"
import { PhaseTimeline } from "@/components/phase/PhaseTimeline"
import type { PhaseCardData } from "@/components/phase/PhaseCard"

const MOCK_PHASES: PhaseCardData[] = [
  {
    phaseNumber: "0",
    status: "APPROVED",
    startedAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 6900000),
    artefactCount: 3,
  },
  {
    phaseNumber: "1",
    status: "APPROVED",
    startedAt: new Date(Date.now() - 6800000),
    completedAt: new Date(Date.now() - 6600000),
    artefactCount: 2,
  },
  {
    phaseNumber: "1A",
    status: "REVIEW",
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 1800000),
    artefactCount: 4,
  },
  {
    phaseNumber: "2",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "3",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "4",
    status: "PENDING",
    artefactCount: 0,
  },
  {
    phaseNumber: "5",
    status: "PENDING",
    artefactCount: 0,
  },
]

const MOCK_STATS = {
  "Total Requirements": 42,
  "Clear": 28,
  "Needs Clarification": 10,
  "Ambiguous": 4,
  "Backend Hours (Low)": "240h",
  "Backend Hours (High)": "320h",
  "Frontend Hours (Low)": "180h",
  "Frontend Hours (High)": "240h",
  "Fixed Cost Items": "80h",
}

export default function EngagementOverviewPage() {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Left: Phase timeline */}
      <div className="flex flex-col gap-3 md:w-[55%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Phases
        </h2>
        <PhaseTimeline phases={MOCK_PHASES} />
      </div>

      {/* Right: Summary stats */}
      <div className="flex flex-col gap-3 md:w-[45%]">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Summary
        </h2>
        <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
          <dl className="flex flex-col gap-3">
            {Object.entries(MOCK_STATS).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-sm text-muted-foreground">{key}</dt>
                <dd className="text-sm font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
