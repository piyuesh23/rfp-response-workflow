"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EngagementGrid } from "@/components/engagement/EngagementGrid"
import { SearchFilter } from "@/components/engagement/SearchFilter"
import { EmptyState } from "@/components/engagement/EmptyState"
import type { EngagementStatus, TechStack } from "@/generated/prisma/client"

interface MockEngagement {
  id: string
  clientName: string
  projectName: string | null
  techStack: TechStack
  status: EngagementStatus
  phaseProgress: { completed: number; total: number }
  updatedAt: Date
}

const MOCK_ENGAGEMENTS: MockEngagement[] = [
  {
    id: "clx001",
    clientName: "Acme Corporation",
    projectName: "Marketing Site Redesign",
    techStack: "DRUPAL_NEXTJS",
    status: "IN_PROGRESS",
    phaseProgress: { completed: 2, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "clx002",
    clientName: "TechStart Inc.",
    projectName: "E-commerce Platform",
    techStack: "NEXTJS",
    status: "DRAFT",
    phaseProgress: { completed: 0, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "clx003",
    clientName: "Global Health Org",
    projectName: null,
    techStack: "DRUPAL",
    status: "COMPLETED",
    phaseProgress: { completed: 5, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
  {
    id: "clx004",
    clientName: "FinTech Solutions",
    projectName: "Dashboard App",
    techStack: "REACT",
    status: "ARCHIVED",
    phaseProgress: { completed: 3, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
  {
    id: "clx005",
    clientName: "EduLearn Platform",
    projectName: "LMS Migration",
    techStack: "DRUPAL",
    status: "IN_PROGRESS",
    phaseProgress: { completed: 1, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: "clx006",
    clientName: "Retail Chain Co.",
    projectName: "Headless Commerce",
    techStack: "DRUPAL_NEXTJS",
    status: "DRAFT",
    phaseProgress: { completed: 0, total: 5 },
    updatedAt: new Date(Date.now() - 1000 * 60 * 20),
  },
]

export default function DashboardPage() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string | null>("all")
  const [techStackFilter, setTechStackFilter] = React.useState<string | null>("all")

  const filtered = MOCK_ENGAGEMENTS.filter((e) => {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {MOCK_ENGAGEMENTS.length} engagement{MOCK_ENGAGEMENTS.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button render={<Link href="/engagements/new" />}>
          <PlusIcon className="size-4" />
          New Engagement
        </Button>
      </div>

      {MOCK_ENGAGEMENTS.length === 0 ? (
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
