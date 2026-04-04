"use client"

import * as React from "react"
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { LineItemRow, calcLowHigh } from "./LineItemRow"
import type { LineItem } from "./LineItemRow"

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey = "task" | "conf" | "hours" | "low" | "high"
type SortDir = "asc" | "desc"

interface EstimateTableProps {
  rows: LineItem[]
  onCellEdit: (id: string, field: "hours", value: number) => void
}

// ─── Sort icon ───────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDownIcon className="size-3 text-muted-foreground/50" />
  return sortDir === "asc"
    ? <ChevronUpIcon className="size-3 text-foreground" />
    : <ChevronDownIcon className="size-3 text-foreground" />
}

// ─── Sortable header cell ─────────────────────────────────────────────────────

function SortableHead({
  col,
  sortKey,
  sortDir,
  onSort,
  className,
  children,
}: {
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (col: SortKey) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </TableHead>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EstimateTable({ rows, onCellEdit }: EstimateTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("task")
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const sorted = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: string | number
      let bv: string | number
      if (sortKey === "task") {
        av = a.task.toLowerCase()
        bv = b.task.toLowerCase()
      } else if (sortKey === "conf") {
        av = a.conf
        bv = b.conf
      } else if (sortKey === "hours") {
        av = a.hours
        bv = b.hours
      } else if (sortKey === "low") {
        av = calcLowHigh(a.hours, a.conf).low
        bv = calcLowHigh(b.hours, b.conf).low
      } else {
        av = calcLowHigh(a.hours, a.conf).high
        bv = calcLowHigh(b.hours, b.conf).high
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  // Totals
  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const { low, high } = calcLowHigh(row.hours, row.conf)
        return { hours: acc.hours + row.hours, low: acc.low + low, high: acc.high + high }
      },
      { hours: 0, low: 0, high: 0 }
    )
  }, [rows])

  return (
    <div className="relative overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-background after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:content-['']">
          <TableRow className="hover:bg-transparent">
            <SortableHead col="task" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="sticky left-0 z-30 bg-background min-w-[160px]">
              Task
            </SortableHead>
            <TableHead className="min-w-[220px]">Description</TableHead>
            <SortableHead col="conf" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-center w-16">
              Conf
            </SortableHead>
            <SortableHead col="hours" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right w-24">
              Hours
            </SortableHead>
            <SortableHead col="low" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right w-20">
              Low Hrs
            </SortableHead>
            <SortableHead col="high" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right w-20">
              High Hrs
            </SortableHead>
            <TableHead className="min-w-[140px]">Assumption Ref</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {sorted.map((row) => (
            <LineItemRow
              key={row.id}
              item={row}
              onHoursChange={(id, val) => onCellEdit(id, "hours", val)}
              isSticky
            />
          ))}
        </TableBody>

        <TableFooter className="sticky bottom-0 z-20 bg-muted/80 backdrop-blur-sm">
          <TableRow className="hover:bg-transparent font-semibold">
            <TableCell className="sticky left-0 z-30 bg-muted/80 backdrop-blur-sm" colSpan={3}>
              Totals ({rows.length} items)
            </TableCell>
            <TableCell className="text-right font-mono">{totals.hours}</TableCell>
            <TableCell className="text-right font-mono">{totals.low}</TableCell>
            <TableCell className="text-right font-mono">{totals.high}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
