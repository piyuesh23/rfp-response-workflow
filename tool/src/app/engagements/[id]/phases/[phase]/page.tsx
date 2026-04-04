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

// Mock per-phase data — replace with real fetch when API is ready
const MOCK_PHASE_DATA: Record<
  string,
  {
    status: PhaseStatus
    stats?: Record<string, string | number>
    versions?: ArtefactVersion[]
    selectedVersion?: number
    description?: string
  }
> = {
  "0": {
    status: "APPROVED",
    stats: { "Pages Discovered": 120, "Integrations Found": 8, "Tech Stack": "Drupal 10" },
    selectedVersion: 2,
    versions: [
      {
        version: 1,
        createdAt: "2026-03-20",
        contentMd: `## Customer Research — v1

### Organisation Profile

Acme Corp is a mid-sized B2B SaaS company operating in the logistics sector.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Drupal 9 |
| Hosting | Acquia Cloud |
| CDN | Cloudflare |

### Integrations Found

- Salesforce CRM
- Google Analytics 4
- Zendesk Support
`,
      },
      {
        version: 2,
        createdAt: "2026-03-22",
        contentMd: `## Customer Research — v2

### Organisation Profile

Acme Corp is a mid-sized B2B SaaS company operating in the logistics sector. Recently acquired LogiStart Ltd (March 2026).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Drupal 9 (migrating to D11) |
| Hosting | Acquia Cloud |
| CDN | Cloudflare |
| Search | Solr 8 |

### Integrations Found

- Salesforce CRM (bidirectional sync)
- Google Analytics 4
- Zendesk Support
- HubSpot Marketing

### Hidden Scope

- LogiStart subdomain requires content migration (~400 nodes)
- Dual-brand theming needed post-acquisition
`,
      },
    ],
  },
  "1": {
    status: "APPROVED",
    stats: { "Requirements": 42, "Clear": 28, "Needs Clarification": 10, "Ambiguous": 4 },
    selectedVersion: 1,
    versions: [
      {
        version: 1,
        createdAt: "2026-03-23",
        contentMd: `## TOR Assessment — v1

### Requirement Coverage

| Area | Count | Clarity |
|------|-------|---------|
| Content Architecture | 12 | Clear |
| Integrations | 8 | Needs Clarification |
| Migration | 6 | Ambiguous |
| Frontend/Theming | 10 | Clear |
| DevOps | 6 | Clear |

### Key Ambiguities

1. Migration scope undefined — number of content types not specified
2. SSO integration provider unknown
3. Accessibility standard not stated (WCAG 2.1 AA assumed)
`,
      },
    ],
  },
  "1A": {
    status: "REVIEW",
    stats: { "Backend Low": "240h", "Backend High": "320h", "Frontend Low": "180h", "Frontend High": "240h" },
    selectedVersion: 3,
    versions: [
      {
        version: 1,
        createdAt: "2026-03-24",
        contentMd: `## Optimistic Estimate — v1

### Backend Tab

| Task | Conf | Low Hrs | High Hrs |
|------|------|---------|---------|
| Discovery & Architecture | 5 | 16 | 20 |
| Environment Setup | 6 | 8 | 8 |
| Base Drupal Config | 6 | 8 | 8 |
| Content Types (10) | 4 | 40 | 60 |
| Migration | 3 | 60 | 90 |

### Assumptions

- Migration covers 500 nodes (assumption — TOR unspecified)
- SSO via Drupal SAML module (T2 integration)
`,
      },
      {
        version: 2,
        createdAt: "2026-03-26",
        contentMd: `## Optimistic Estimate — v2

### Backend Tab

| Task | Conf | Low Hrs | High Hrs |
|------|------|---------|---------|
| Discovery & Architecture | 5 | 16 | 20 |
| Environment Setup | 6 | 8 | 8 |
| Base Drupal Config | 6 | 8 | 8 |
| Content Types (10) | 4 | 40 | 60 |
| Migration | 3 | 60 | 90 |
| Dual-brand Theming (new) | 3 | 24 | 40 |

### Assumptions

- Migration covers 500 nodes + 400 LogiStart nodes
- SSO via Drupal SAML module (T2 integration)
- Dual-brand theming required post-acquisition
`,
      },
      {
        version: 3,
        createdAt: "2026-03-28",
        contentMd: `## Optimistic Estimate — v3

### Backend Tab

| Task | Conf | Low Hrs | High Hrs |
|------|------|---------|---------|
| Discovery & Architecture | 5 | 16 | 20 |
| Environment Setup | 6 | 8 | 8 |
| Base Drupal Config | 6 | 8 | 8 |
| Content Types (12) | 4 | 48 | 72 |
| Migration | 3 | 80 | 120 |
| Dual-brand Theming | 3 | 24 | 40 |
| Solr Search Integration | 4 | 16 | 24 |

### Frontend Tab

| Component | Conf | Low Hrs | High Hrs |
|-----------|------|---------|---------|
| Design System | 5 | 24 | 30 |
| Header / Nav | 5 | 12 | 15 |
| Hero Banner | 6 | 8 | 8 |
| Card Component | 6 | 6 | 6 |
| Search Results Page | 4 | 16 | 24 |

### Assumptions

- Migration: 900 nodes total (500 primary + 400 LogiStart)
- SSO via Drupal SAML module (T2 integration)
- Dual-brand theming required post-acquisition
- Solr 8 already provisioned on Acquia
`,
      },
    ],
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
    const versionCount = data.versions?.length ?? 0
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
            Review
          </Badge>
          {versionCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {versionCount} {versionCount === 1 ? "version" : "versions"}
            </Badge>
          )}
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
        />
      </div>
    )
  }

  if (data.status === "APPROVED") {
    const versionCount = data.versions?.length ?? 0
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Phase {phase}: {label}
          </h2>
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">
            Approved
          </Badge>
          {versionCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {versionCount} {versionCount === 1 ? "version" : "versions"}
            </Badge>
          )}
        </div>
        <PhaseGate
          stats={data.stats}
          versions={data.versions}
          selectedVersion={data.selectedVersion}
          readOnly
          onBack={() => router.push(`/engagements/${id}`)}
        />
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
