"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EstimateTable } from "./EstimateTable"
import { calcLowHigh } from "./LineItemRow"
import type { LineItem } from "./LineItemRow"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export type TabKey = "backend" | "frontend" | "fixed" | "ai"

export interface EstimateData {
  backend: LineItem[]
  frontend: LineItem[]
  fixed: LineItem[]
  ai: LineItem[]
}

interface TabbedEstimateProps {
  initialData: EstimateData
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_CONFIG: { key: TabKey; label: string; value: string }[] = [
  { key: "backend", label: "Backend", value: "backend" },
  { key: "frontend", label: "Frontend", value: "frontend" },
  { key: "fixed", label: "Fixed Cost Items", value: "fixed" },
  { key: "ai", label: "AI", value: "ai" },
]

// ─── Summary row ─────────────────────────────────────────────────────────────

function TabSummaryBar({ rows, label }: { rows: LineItem[]; label: string }) {
  const totals = rows.reduce(
    (acc, row) => {
      const { low, high } = calcLowHigh(row.hours, row.conf)
      return { hours: acc.hours + row.hours, low: acc.low + low, high: acc.high + high }
    },
    { hours: 0, low: 0, high: 0 }
  )
  return (
    <div className="flex items-center gap-6 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
      <span className="font-medium text-muted-foreground">{label} summary</span>
      <span>
        <span className="text-muted-foreground">Base: </span>
        <span className="font-mono font-medium">{totals.hours} hrs</span>
      </span>
      <span>
        <span className="text-muted-foreground">Low: </span>
        <span className="font-mono font-medium">{totals.low} hrs</span>
      </span>
      <span>
        <span className="text-muted-foreground">High: </span>
        <span className="font-mono font-semibold">{totals.high} hrs</span>
      </span>
    </div>
  )
}

// ─── Grand total bar ──────────────────────────────────────────────────────────

function GrandTotalBar({ data }: { data: EstimateData }) {
  const allRows = [
    ...data.backend,
    ...data.frontend,
    ...data.fixed,
    ...data.ai,
  ]
  const totals = allRows.reduce(
    (acc, row) => {
      const { low, high } = calcLowHigh(row.hours, row.conf)
      return { hours: acc.hours + row.hours, low: acc.low + low, high: acc.high + high }
    },
    { hours: 0, low: 0, high: 0 }
  )
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border-2 border-primary/20 bg-primary/5 px-5 py-3 text-sm">
      <span className="font-semibold">Grand Total</span>
      <span>
        <span className="text-muted-foreground">Base: </span>
        <span className="font-mono font-medium">{totals.hours} hrs</span>
      </span>
      <span>
        <span className="text-muted-foreground">Low: </span>
        <span className="font-mono font-medium">{totals.low} hrs</span>
      </span>
      <span>
        <span className="text-muted-foreground">High: </span>
        <span className="font-mono text-base font-bold">{totals.high} hrs</span>
      </span>
      <span className="ml-auto text-xs text-muted-foreground">
        {allRows.length} line items across all tabs
      </span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TabbedEstimate({ initialData }: TabbedEstimateProps) {
  const [data, setData] = React.useState<EstimateData>(initialData)

  function handleCellEdit(tab: TabKey, id: string, field: "hours", value: number) {
    setData((prev) => ({
      ...prev,
      [tab]: prev[tab].map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="backend">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-muted p-1">
          {TAB_CONFIG.map(({ key, label, value }) => {
            const count = data[key].length
            return (
              <TabsTrigger
                key={key}
                value={value}
                className="gap-2 rounded-md px-3 py-1.5 text-sm"
              >
                {label}
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold font-mono",
                    "bg-muted-foreground/15 text-muted-foreground",
                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {TAB_CONFIG.map(({ key, label, value }) => (
          <TabsContent key={key} value={value} className="mt-4 flex flex-col gap-3">
            <TabSummaryBar rows={data[key]} label={label} />
            <EstimateTable
              rows={data[key]}
              onCellEdit={(id, field, val) => handleCellEdit(key, id, field, val)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <GrandTotalBar data={data} />
    </div>
  )
}
