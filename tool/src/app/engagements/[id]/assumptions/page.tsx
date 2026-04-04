"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssumptionList, type Assumption, type AssumptionStatus } from "@/components/assumption/AssumptionList"

const INITIAL_ASSUMPTIONS: Assumption[] = [
  {
    id: "a1",
    text: "SSO will use SAML 2.0 via Okta. No OIDC or legacy LDAP integration is required.",
    torReference: "TOR §4.2 — Authentication & Access Control",
    impactIfWrong: "Switch to OIDC or ADFS adds 16–24h backend effort and may require a different module.",
    status: "ACTIVE",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
  {
    id: "a2",
    text: "Content migration covers up to 500 nodes. No media file migration (images/videos) is in scope.",
    torReference: "TOR §6.1 — Content Migration",
    impactIfWrong: "Exceeding 500 nodes or including media adds 20–40h migration effort.",
    status: "ACTIVE",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
  {
    id: "a3",
    text: "Two languages (English + French). Translation workflow is manual — editors paste translations into CMS. No third-party translation service integration.",
    torReference: "TOR §3.4 — Multilingual Requirements",
    impactIfWrong: "Integration with Phrase/Crowdin adds 16h backend + ongoing maintenance overhead.",
    status: "ACTIVE",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
  {
    id: "a4",
    text: "Payment gateway is Stripe. PCI-DSS scope is limited to SAQ-A (hosted fields / Stripe Elements). No server-side card data handling.",
    torReference: "TOR §5.3 — E-commerce & Payments",
    impactIfWrong: "Server-side card handling or a different gateway adds 40–56h and introduces PCI audit scope.",
    status: "ACTIVE",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
  {
    id: "a5",
    text: "Hosting platform is Acquia Cloud Enterprise. CI/CD via Acquia Pipelines. No custom Kubernetes or self-hosted infrastructure.",
    torReference: "TOR §8.1 — Hosting & Infrastructure",
    impactIfWrong: "Self-hosted k8s setup adds 16–24h DevOps effort and may require a separate infrastructure sprint.",
    status: "CONFIRMED",
    sourcePhase: "Phase 2 — Customer Q&A",
  },
  {
    id: "a6",
    text: "Design system will be built using an existing Figma component library provided by the client. No design system creation from scratch.",
    torReference: "TOR §7.1 — Design & Theming",
    impactIfWrong: "Creating a design system from scratch adds 24–32h frontend effort.",
    status: "CONFIRMED",
    sourcePhase: "Phase 2 — Customer Q&A",
  },
  {
    id: "a7",
    text: "AI-powered search returns ranked results only — no generative summaries or RAG pipeline required.",
    torReference: "TOR §9.2 — Search & Discovery",
    impactIfWrong: "Adding a generative summarisation layer (RAG) adds 32–48h AI/backend effort.",
    status: "ACTIVE",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
  {
    id: "a8",
    text: "Accessibility target is WCAG 2.1 AA. No AAA compliance or automated accessibility testing pipeline is required in-scope.",
    torReference: "TOR §2.5 — Accessibility",
    impactIfWrong: "WCAG AAA or automated a11y CI adds 8–16h QA and frontend effort.",
    status: "ACTIVE",
    sourcePhase: "Phase 1 — TOR Analysis",
  },
  {
    id: "a9",
    text: "UAT will be conducted by the client's internal team. QED42 provides a 2-week hypercare period post-launch but not extended UAT facilitation.",
    torReference: "TOR §10.1 — Project Delivery",
    impactIfWrong: "Facilitated UAT or extended hypercare adds 16–24h Fixed Cost effort.",
    status: "REJECTED",
    sourcePhase: "Phase 2 — Customer Q&A",
  },
  {
    id: "a10",
    text: "CRM integration is read-only (contact lookup). No bi-directional sync or real-time webhook pipeline with Salesforce.",
    torReference: "TOR §5.1 — CRM Integration",
    impactIfWrong: "Bi-directional sync or real-time webhooks upgrades integration from T2 to T3 (+24–32h backend).",
    status: "SUPERSEDED",
    sourcePhase: "Phase 1A — Optimistic Estimate",
  },
]

type FilterStatus = "All" | AssumptionStatus

export default function AssumptionsPage() {
  const [assumptions, setAssumptions] = React.useState<Assumption[]>(INITIAL_ASSUMPTIONS)
  const [filter, setFilter] = React.useState<FilterStatus>("All")

  function handleStatusChange(id: string, newStatus: AssumptionStatus) {
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }

  const filtered =
    filter === "All" ? assumptions : assumptions.filter((a) => a.status === filter)

  const counts: Record<AssumptionStatus, number> = {
    ACTIVE: assumptions.filter((a) => a.status === "ACTIVE").length,
    CONFIRMED: assumptions.filter((a) => a.status === "CONFIRMED").length,
    REJECTED: assumptions.filter((a) => a.status === "REJECTED").length,
    SUPERSEDED: assumptions.filter((a) => a.status === "SUPERSEDED").length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Assumption Register</h2>
          <Badge variant="secondary" className="tabular-nums">
            {assumptions.length}
          </Badge>
        </div>

        {/* Status filter */}
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All ({assumptions.length})</SelectItem>
            <SelectItem value="ACTIVE">Active ({counts.ACTIVE})</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed ({counts.CONFIRMED})</SelectItem>
            <SelectItem value="REJECTED">Rejected ({counts.REJECTED})</SelectItem>
            <SelectItem value="SUPERSEDED">Superseded ({counts.SUPERSEDED})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assumption list */}
      <AssumptionList assumptions={filtered} onStatusChange={handleStatusChange} />
    </div>
  )
}
