"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { RiskRegister, type RiskItem } from "@/components/risk/RiskRegister"
import { AlertTriangleIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { getSeverity } from "@/components/risk/RiskBadge"

export default function RisksPage() {
  const params = useParams<{ id: string }>()
  const engagementId = params.id

  const [risks, setRisks] = React.useState<RiskItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!engagementId) return
    fetch(`/api/engagements/${engagementId}/risks`)
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`))
        return res.json() as Promise<RiskItem[]>
      })
      .then(setRisks)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load risks")
      )
      .finally(() => setLoading(false))
  }, [engagementId])

  const highCount = risks.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "High").length
  const mediumCount = risks.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "Medium").length
  const lowCount = risks.filter((r) => getSeverity(r.conf, r.hoursAtRisk) === "Low").length
  const totalHours = risks.reduce((sum, r) => sum + r.hoursAtRisk, 0)

  const summaryCards = [
    {
      label: "Total Risks",
      value: risks.length,
      icon: ShieldIcon,
      className: "text-foreground",
    },
    {
      label: "High",
      value: highCount,
      icon: ShieldAlertIcon,
      className: "text-red-600 dark:text-red-400",
    },
    {
      label: "Medium",
      value: mediumCount,
      icon: AlertTriangleIcon,
      className: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Low",
      value: lowCount,
      icon: ShieldCheckIcon,
      className: "text-green-600 dark:text-green-400",
    },
    {
      label: "Hours at Risk",
      value: `${totalHours}h`,
      icon: ShieldAlertIcon,
      className: "text-foreground",
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Risk Register</h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading risks...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Risk Register</h2>
        </div>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Risk Register</h2>
        <Badge variant="secondary" className="tabular-nums">
          {risks.length}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon, className }) => (
          <Card key={label} className="ring-1 ring-foreground/10">
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`size-4 ${className}`} />
              </div>
              <span className={`text-2xl font-bold tabular-nums ${className}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk table */}
      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No risks found. Run an estimate phase (1A, 3) to extract risk register entries.
        </p>
      ) : (
        <RiskRegister items={risks} />
      )}
    </div>
  )
}
