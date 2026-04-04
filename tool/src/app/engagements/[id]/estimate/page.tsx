"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon, AlertTriangleIcon } from "lucide-react"
import { TabbedEstimate } from "@/components/estimate/TabbedEstimate"
import { ExportButtons } from "@/components/estimate/ExportButtons"
import { ConfBadge, CONF_CONFIG } from "@/components/estimate/ConfBadge"
import { calcLowHigh } from "@/components/estimate/LineItemRow"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { EstimateData } from "@/components/estimate/TabbedEstimate"
import type { LineItem } from "@/components/estimate/LineItemRow"

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DATA: EstimateData = {
  backend: [
    {
      id: "be-1",
      task: "Discovery & Setup",
      description: "Project kickoff, environment provisioning, repository setup, CI/CD pipeline configuration.",
      conf: 6,
      hours: 16,
      assumptionRef: "TOR §1.1 — Standard onboarding process assumed",
    },
    {
      id: "be-2",
      task: "Content Architecture",
      description: "Define and implement content types, taxonomies, fields, and editorial workflows in Drupal.",
      conf: 4,
      hours: 40,
      assumptionRef: "TOR §3.2 — 8–10 content types assumed; final count TBC",
    },
    {
      id: "be-3",
      task: "Salesforce CRM Integration",
      description: "Bi-directional sync of lead/contact data between Drupal webforms and Salesforce via REST API.",
      conf: 3,
      hours: 48,
      assumptionRef: "Q&A Q7 — Sandbox access not yet confirmed",
    },
    {
      id: "be-4",
      task: "Search (Solr)",
      description: "Apache Solr integration with faceted search, relevance tuning, and content indexing.",
      conf: 5,
      hours: 32,
      assumptionRef: "TOR §4.1 — Acquia Search Solr assumed",
    },
    {
      id: "be-5",
      task: "Deployment & QA Pipeline",
      description: "Pantheon multidev setup, automated deployments, smoke tests, and stabilisation sprint.",
      conf: 6,
      hours: 24,
      assumptionRef: "TOR §6 — Pantheon hosting confirmed",
    },
  ],
  frontend: [
    {
      id: "fe-1",
      task: "Design System",
      description: "Token-based design system setup: typography, colour palette, spacing scale, component primitives in Storybook.",
      conf: 5,
      hours: 32,
      assumptionRef: "TOR §5.1 — Brand guidelines to be provided by client",
    },
    {
      id: "fe-2",
      task: "Header & Navigation",
      description: "Responsive mega-nav with mobile drawer, active states, and ARIA landmark roles. Ref: nytimes.com header.",
      conf: 5,
      hours: 24,
      assumptionRef: "TOR §5.2 — Max 3 nav levels assumed",
    },
    {
      id: "fe-3",
      task: "Hero Component",
      description: "Full-bleed hero with background image/video, headline, CTA buttons. Ref: stripe.com/en-au homepage hero.",
      conf: 6,
      hours: 12,
      assumptionRef: "TOR §5.3 — Static image variant only; video variant +8 hrs",
    },
    {
      id: "fe-4",
      task: "Card & Listing Grid",
      description: "Reusable card component (image, title, summary, tag, CTA) used across news, events, and resources listings.",
      conf: 4,
      hours: 20,
      assumptionRef: "TOR §5.4 — Card variants not fully specified",
    },
    {
      id: "fe-5",
      task: "Footer",
      description: "Multi-column footer with social links, newsletter signup, legal links, and accessibility compliance.",
      conf: 6,
      hours: 10,
      assumptionRef: "TOR §5.2 — Standard footer layout assumed",
    },
  ],
  fixed: [
    {
      id: "fc-1",
      task: "Project Management",
      description: "Fortnightly sprints, stakeholder reporting, risk tracking, and backlog management across engagement.",
      conf: 6,
      hours: 30,
      assumptionRef: "Standard QED42 engagement process",
    },
    {
      id: "fc-2",
      task: "Content Migration",
      description: "Migrate existing content from legacy CMS (approx. 500 nodes) via migration scripts with validation.",
      conf: 3,
      hours: 40,
      assumptionRef: "Q&A Q12 — Legacy CMS access and data export format TBC",
    },
    {
      id: "fc-3",
      task: "Training & Documentation",
      description: "Editor training session (2 hrs), admin guide, and deployment runbook delivered at project close.",
      conf: 6,
      hours: 16,
      assumptionRef: "TOR §7 — Two training sessions assumed",
    },
    {
      id: "fc-4",
      task: "Hypercare / Warranty",
      description: "30-day post-launch support window for critical bug fixes and minor configuration changes.",
      conf: 5,
      hours: 20,
      assumptionRef: "Standard QED42 warranty policy",
    },
  ],
  ai: [
    {
      id: "ai-1",
      task: "AI Content Tagging",
      description: "LLM-assisted automatic taxonomy tagging on content save using OpenAI API with editor override capability.",
      conf: 4,
      hours: 36,
      assumptionRef: "TOR §8.1 — OpenAI API key to be provided by client",
    },
    {
      id: "ai-2",
      task: "Semantic Search",
      description: "Vector embedding pipeline for semantic search using pgvector and Drupal Search API integration.",
      conf: 3,
      hours: 48,
      assumptionRef: "Q&A Q15 — Embedding model and hosting approach TBC",
    },
    {
      id: "ai-3",
      task: "AI Chatbot Widget",
      description: "RAG-powered support chatbot trained on site content, embedded as a floating widget with conversation history.",
      conf: 2,
      hours: 60,
      assumptionRef: "TOR §8.3 — Scope, data privacy, and integration points under-defined",
    },
  ],
}

// ─── Risk Register ────────────────────────────────────────────────────────────

function collectRiskItems(data: EstimateData): LineItem[] {
  const all: LineItem[] = [
    ...data.backend,
    ...data.frontend,
    ...data.fixed,
    ...data.ai,
  ]
  return all.filter((item) => item.conf <= 4)
}

function tabLabel(data: EstimateData, item: LineItem): string {
  if (data.backend.find((r) => r.id === item.id)) return "Backend"
  if (data.frontend.find((r) => r.id === item.id)) return "Frontend"
  if (data.fixed.find((r) => r.id === item.id)) return "Fixed Cost"
  return "AI"
}

interface RiskRegisterProps {
  data: EstimateData
}

function RiskRegister({ data }: RiskRegisterProps) {
  const [open, setOpen] = React.useState(false)
  const riskItems = collectRiskItems(data)

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />
        <span className="font-semibold">Risk Register</span>
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold font-mono text-amber-700">
          {riskItems.length}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Items with Conf ≤ 4
        </span>
        {open ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <Separator />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Tab</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Task</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-center">Conf</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right font-mono">High Hrs</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Open Question / Assumption</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">De-risk Action</th>
                </tr>
              </thead>
              <tbody>
                {riskItems.map((item) => {
                  const { high } = calcLowHigh(item.hours, item.conf)
                  const bufferLabel = CONF_CONFIG[item.conf].buffer
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/30",
                        item.conf <= 2 && "bg-red-50/40"
                      )}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {tabLabel(data, item)}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.task}</td>
                      <td className="px-4 py-3 text-center">
                        <ConfBadge value={item.conf} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {high}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (+{bufferLabel}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px] whitespace-normal leading-snug">
                        {item.assumptionRef ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] whitespace-normal leading-snug text-xs">
                        {item.conf <= 2
                          ? "Requires client clarification before estimation can be confirmed. Treat as T&M."
                          : item.conf === 3
                          ? "Seek written confirmation from client. Schedule scoping call before sprint start."
                          : "Review with lead architect before finalising. Flag in assumptions register."}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EstimatePage() {
  const clientName = "Acme Corporation"

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Estimate —{" "}
            <span className="text-primary">{clientName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Drupal + Next.js · New Build · Last updated 4 Apr 2026
          </p>
        </div>
        <ExportButtons />
      </div>

      <Separator className="mb-6" />

      {/* Tabbed estimate */}
      <TabbedEstimate initialData={MOCK_DATA} />

      {/* Risk Register */}
      <div className="mt-6">
        <RiskRegister data={MOCK_DATA} />
      </div>
    </div>
  )
}
