"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { ChevronDownIcon, ChevronRightIcon, AlertTriangleIcon, Loader2 } from "lucide-react"
import { TabbedEstimate } from "@/components/estimate/TabbedEstimate"
import { ExportButtons } from "@/components/estimate/ExportButtons"
import { ConfBadge, CONF_CONFIG } from "@/components/estimate/ConfBadge"
import { calcLowHigh } from "@/components/estimate/LineItemRow"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { parseEstimateMarkdown, estimateDataToExcelTabs } from "@/lib/estimate-parser"
import type { EstimateData } from "@/components/estimate/TabbedEstimate"
import type { LineItem } from "@/components/estimate/LineItemRow"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

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
  if (data.design.find((r) => r.id === item.id)) return "Design"
  return "AI"
}

interface RiskRegisterProps {
  data: EstimateData
}

function RiskRegister({ data }: RiskRegisterProps) {
  const [open, setOpen] = React.useState(false)
  const riskItems = collectRiskItems(data)

  if (riskItems.length === 0) return null

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

interface Artefact {
  id: string
  artefactType: string
  version: number
  contentMd: string | null
  createdAt: string
}

interface Phase {
  phaseNumber: string
  artefacts: Artefact[]
}

interface EngagementResponse {
  id: string
  clientName: string
  techStack: string
  engagementType: string
  updatedAt: string
  phases: Phase[]
}

export default function EstimatePage() {
  const { id } = useParams<{ id: string }>()

  const { data, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.engagement(id),
    queryFn: () =>
      fetch(`/api/engagements/${id}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch engagement")
        return r.json() as Promise<EngagementResponse>
      }),
  })

  const clientName = data?.clientName ?? ""
  const techStack = data ? data.techStack.replace(/_/g, " + ") : ""
  const engagementType = data ? data.engagementType.replace(/_/g, " ") : ""
  const updatedAt = data
    ? new Date(data.updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : ""

  const estimateData: EstimateData | null = React.useMemo(() => {
    if (!data) return null
    const estimatePhases = ["1A", "3"]
    for (const pn of estimatePhases) {
      const phase = data.phases.find((p) => p.phaseNumber === pn)
      if (phase) {
        const artefact = phase.artefacts.find(
          (a) => a.artefactType === "ESTIMATE" && a.contentMd
        )
        if (artefact?.contentMd) {
          return parseEstimateMarkdown(artefact.contentMd)
        }
      }
    }
    return null
  }, [data])

  async function handleDownloadExcel() {
    if (!estimateData) return

    // Prefer DB line items (richer: benchmark range, deviation, assumption codes).
    // Fall back to markdown-parsed data if the DB has no rows yet.
    let tabs = estimateDataToExcelTabs(estimateData)
    try {
      const dbRes = await fetch(`/api/engagements/${id}/line-items`)
      if (dbRes.ok) {
        const dbItems = await dbRes.json() as Array<{
          tab: string; task: string; description: string; conf: number;
          hours: number; lowHrs: number; highHrs: number;
          benchmarkRange: string | null; deviationReason: string | null;
          assumptionCodes: string;
        }>
        if (dbItems.length > 0) {
          const tabNameMap: Record<string, string> = {
            BACKEND: "Backend", FRONTEND: "Frontend",
            FIXED_COST: "Fixed Cost Items", DESIGN: "Design", AI: "AI",
          }
          const grouped: Record<string, typeof dbItems> = {}
          for (const item of dbItems) {
            const name = tabNameMap[item.tab] ?? item.tab
            if (!grouped[name]) grouped[name] = []
            grouped[name].push(item)
          }
          tabs = Object.entries(grouped).map(([name, rows]) => ({
            name,
            rows: rows.map((r) => ({
              task: r.task,
              description: r.description,
              conf: r.conf,
              hours: r.hours,
              lowHrs: r.lowHrs,
              highHrs: r.highHrs,
              benchmarkRange: r.benchmarkRange ?? undefined,
              deviationReason: r.deviationReason ?? undefined,
              assumptionCodes: r.assumptionCodes || undefined,
            })),
          }))
        }
      }
    } catch {
      // Non-fatal — use markdown-parsed fallback
    }

    const res = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs, clientName }),
    })

    if (!res.ok) return

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${clientName.replace(/[^a-zA-Z0-9-_]/g, "-")}-estimate.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-destructive">Failed to fetch engagement</p>
      </div>
    )
  }

  if (!estimateData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertTriangleIcon className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No estimate artefact found. Run Phase 1A or Phase 3 to generate estimates.
        </p>
      </div>
    )
  }

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
            {techStack} · {engagementType} · Last updated {updatedAt}
          </p>
        </div>
        <ExportButtons onDownloadExcel={handleDownloadExcel} />
      </div>

      <Separator className="mb-6" />

      {/* Tabbed estimate */}
      <TabbedEstimate initialData={estimateData} />

      {/* Risk Register */}
      <div className="mt-6">
        <RiskRegister data={estimateData} />
      </div>
    </div>
  )
}
