"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RiskBadge, getSeverity, type Severity } from "@/components/risk/RiskBadge"
import { ChevronDownIcon, ChevronUpIcon, ArrowUpDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RiskItem {
  id: string
  task: string
  tab: "Backend" | "Frontend" | "Fixed Cost" | "AI"
  conf: number
  risk: string
  openQuestion: string
  recommendedAction: string
  hoursAtRisk: number
}

type TabFilter = "All" | "Backend" | "Frontend" | "Fixed Cost" | "AI"
type SeverityFilter = "All" | Severity
type SortField = "conf" | "hoursAtRisk" | null
type SortDir = "asc" | "desc"

const TAB_BADGE_CLASSES: Record<RiskItem["tab"], string> = {
  Backend: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  Frontend: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  "Fixed Cost": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  AI: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
}

interface RiskRegisterProps {
  items: RiskItem[]
}

export function RiskRegister({ items }: RiskRegisterProps) {
  const [tabFilter, setTabFilter] = React.useState<TabFilter>("All")
  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>("All")
  const [sortField, setSortField] = React.useState<SortField>(null)
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = items.filter((item) => {
    if (tabFilter !== "All" && item.tab !== tabFilter) return false
    if (severityFilter !== "All" && getSeverity(item.conf, item.hoursAtRisk) !== severityFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField]
    const bVal = b[sortField]
    const dir = sortDir === "asc" ? 1 : -1
    return aVal < bVal ? -dir : aVal > bVal ? dir : 0
  })

  const totalHours = sorted.reduce((sum, item) => sum + item.hoursAtRisk, 0)

  function SortButton({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <button
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUpIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )
        ) : (
          <ArrowUpDownIcon className="size-3.5 opacity-40" />
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Tab" />
          </SelectTrigger>
          <SelectContent>
            {(["All", "Backend", "Frontend", "Fixed Cost", "AI"] as TabFilter[]).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {(["All", "High", "Medium", "Low"] as SeverityFilter[]).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(tabFilter !== "All" || severityFilter !== "All") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setTabFilter("All")
              setSeverityFilter("All")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border ring-1 ring-foreground/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Task</TableHead>
              <TableHead>Tab</TableHead>
              <TableHead>
                <SortButton field="conf" label="Conf" />
              </TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="max-w-56">Risk / Dependency</TableHead>
              <TableHead className="max-w-48">Open Question</TableHead>
              <TableHead className="max-w-48">Recommended Action</TableHead>
              <TableHead className="text-right">
                <SortButton field="hoursAtRisk" label="Hrs at Risk" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No risks match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item) => {
                const expanded = expandedRows.has(item.id)
                return (
                  <React.Fragment key={item.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleRow(item.id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {expanded ? (
                          <ChevronUpIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-48 whitespace-normal">
                        {item.task}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", TAB_BADGE_CLASSES[item.tab])}>
                          {item.tab}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums font-semibold">{item.conf}</span>
                        <span className="text-muted-foreground text-xs">/6</span>
                      </TableCell>
                      <TableCell>
                        <RiskBadge conf={item.conf} hoursAtRisk={item.hoursAtRisk} />
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal text-sm">
                        {item.risk}
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-normal text-sm text-muted-foreground">
                        {item.openQuestion}
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-normal text-sm text-muted-foreground">
                        {item.recommendedAction}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {item.hoursAtRisk}h
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={8} className="py-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Risk / Dependency</p>
                              <p className="whitespace-normal">{item.risk}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Open Question</p>
                              <p className="whitespace-normal">{item.openQuestion}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recommended Action</p>
                              <p className="whitespace-normal">{item.recommendedAction}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={8} className="text-sm font-semibold">
                Total hours at risk ({sorted.length} item{sorted.length !== 1 ? "s" : ""})
              </TableCell>
              <TableCell className="text-right tabular-nums font-bold">
                {totalHours}h
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
