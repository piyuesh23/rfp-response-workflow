"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssumptionList, type Assumption, type AssumptionStatus } from "@/components/assumption/AssumptionList"

type FilterStatus = "All" | AssumptionStatus

export default function AssumptionsPage() {
  const params = useParams<{ id: string }>()
  const engagementId = params.id

  const [assumptions, setAssumptions] = React.useState<Assumption[]>([])
  const [filter, setFilter] = React.useState<FilterStatus>("All")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!engagementId) return
    fetch(`/api/engagements/${engagementId}/assumptions`)
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`))
        return res.json() as Promise<Assumption[]>
      })
      .then(setAssumptions)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load assumptions")
      )
      .finally(() => setLoading(false))
  }, [engagementId])

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Assumption Register</h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading assumptions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Assumption Register</h2>
        </div>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
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
      {assumptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assumptions found. Run an estimate phase (1A, 3) to extract assumption entries.
        </p>
      ) : (
        <AssumptionList assumptions={filtered} onStatusChange={handleStatusChange} />
      )}
    </div>
  )
}
