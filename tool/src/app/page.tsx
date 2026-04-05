"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EngagementGrid } from "@/components/engagement/EngagementGrid"
import { SearchFilter } from "@/components/engagement/SearchFilter"
import { EmptyState } from "@/components/engagement/EmptyState"
import type { EngagementStatus, TechStack } from "@/generated/prisma/client"

interface Engagement {
  id: string
  clientName: string
  projectName: string | null
  techStack: TechStack
  status: EngagementStatus
  phases: { status: string }[]
  updatedAt: string
}

interface GridEngagement {
  id: string
  clientName: string
  projectName: string | null
  techStack: TechStack
  status: EngagementStatus
  phaseProgress: { completed: number; total: number }
  updatedAt: Date
}

export default function DashboardPage() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string | null>("all")
  const [techStackFilter, setTechStackFilter] = React.useState<string | null>("all")
  const [engagements, setEngagements] = React.useState<GridEngagement[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/engagements")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Engagement[]) => {
        setEngagements(
          data.map((e) => ({
            id: e.id,
            clientName: e.clientName,
            projectName: e.projectName,
            techStack: e.techStack,
            status: e.status,
            phaseProgress: {
              completed: e.phases?.filter((p) => p.status === "APPROVED" || p.status === "SKIPPED").length ?? 0,
              total: e.phases?.length ?? 0,
            },
            updatedAt: new Date(e.updatedAt),
          }))
        )
      })
      .catch(() => setEngagements([]))
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) {
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
