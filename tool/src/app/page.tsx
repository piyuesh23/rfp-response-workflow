"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { EngagementGrid } from "@/components/engagement/EngagementGrid"
import { SearchFilter } from "@/components/engagement/SearchFilter"
import { EmptyState } from "@/components/engagement/EmptyState"
import { queryKeys } from "@/lib/query-keys"
import type { EngagementStatus, TechStack } from "@/generated/prisma/client"

interface CostSummary {
  totalTokens: number
  estimatedCostUsd: number
  phasesRun: number
}

interface Engagement {
  id: string
  clientName: string
  projectName: string | null
  techStack: TechStack
  status: EngagementStatus
  workflowPath: "NO_RESPONSE" | "HAS_RESPONSE" | null
  phases: { phaseNumber: string; status: string }[]
  updatedAt: string
  costSummary?: CostSummary | null
  importSource?: string | null
}

interface GridEngagement {
  id: string
  clientName: string
  projectName: string | null
  techStack: TechStack
  status: EngagementStatus
  workflowPath: "NO_RESPONSE" | "HAS_RESPONSE" | null
  phaseProgress: { completed: number; total: number }
  updatedAt: Date
  costSummary?: CostSummary | null
  importSource?: string | null
}

const NO_RESPONSE_PHASES = new Set(["0", "1", "1A", "5"])
const HAS_RESPONSE_PHASES = new Set(["0", "1", "2", "3", "3R", "5"])

function mapEngagement(e: Engagement): GridEngagement {
  const wp = e.workflowPath
  const activePhases = wp === "NO_RESPONSE"
    ? e.phases.filter((p) => NO_RESPONSE_PHASES.has(p.phaseNumber))
    : wp === "HAS_RESPONSE"
    ? e.phases.filter((p) => HAS_RESPONSE_PHASES.has(p.phaseNumber))
    : e.phases

  return {
    id: e.id,
    clientName: e.clientName,
    projectName: e.projectName,
    techStack: e.techStack,
    status: e.status,
    workflowPath: wp,
    phaseProgress: {
      completed: activePhases.filter((p) => p.status === "APPROVED" || p.status === "SKIPPED").length,
      total: activePhases.length,
    },
    updatedAt: new Date(e.updatedAt),
    costSummary: e.costSummary ?? null,
    importSource: e.importSource ?? null,
  }
}

export default function DashboardPage() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string | null>("all")
  const [techStackFilter, setTechStackFilter] = React.useState<string | null>("all")

  const { data: rawEngagements, isPending } = useQuery({
    queryKey: queryKeys.engagements(),
    queryFn: () =>
      fetch("/api/engagements").then((r) => (r.ok ? r.json() as Promise<Engagement[]> : Promise.reject(r))),
  })

  const engagements: GridEngagement[] = React.useMemo(
    () => (rawEngagements ?? []).map(mapEngagement),
    [rawEngagements]
  )

  const filtered = engagements.filter((e) => {
    const matchesSearch =
      search.trim() === "" ||
      e.clientName.toLowerCase().includes(search.toLowerCase()) ||
      (e.projectName ?? "").toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      !statusFilter || statusFilter === "all" || e.status === statusFilter

    const matchesTechStack =
      !techStackFilter || techStackFilter === "all" || e.techStack === techStackFilter

    return matchesSearch && matchesStatus && matchesTechStack
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Loading engagements...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {engagements.length} engagement{engagements.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button render={<Link href="/engagements/new" />}>
          <PlusIcon className="size-4" />
          New Engagement
        </Button>
      </div>

      {engagements.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          <SearchFilter
            searchValue={search}
            statusValue={statusFilter}
            techStackValue={techStackFilter}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onTechStackChange={setTechStackFilter}
          />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <EngagementGrid engagements={filtered} />
          )}
        </div>
      )}
    </div>
  )
}
