"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { ConfBadge, CONF_CONFIG } from "./ConfBadge"
import { HoursCell } from "./HoursCell"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string
  task: string
  description: string
  conf: 1 | 2 | 3 | 4 | 5 | 6
  hours: number
  assumptionRef?: string
}

interface LineItemRowProps {
  item: LineItem
  onHoursChange: (id: string, newHours: number) => void
  isSticky?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calcLowHigh(hours: number, conf: 1 | 2 | 3 | 4 | 5 | 6): { low: number; high: number } {
  const bufferPct = CONF_CONFIG[conf].buffer / 100
  return {
    low: hours,
    high: Math.round(hours * (1 + bufferPct) * 10) / 10,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LineItemRow({ item, onHoursChange, isSticky }: LineItemRowProps) {
  const { low, high } = calcLowHigh(item.hours, item.conf)

  return (
    <TableRow className="group/row hover:bg-muted/40 transition-colors">
      {/* Task — sticky on mobile */}
      <TableCell
        className={cn(
          "font-medium text-sm max-w-[200px]",
          isSticky && "sticky left-0 z-10 bg-background group-hover/row:bg-muted/40 transition-colors"
        )}
      >
        {item.task}
      </TableCell>

      {/* Description */}
      <TableCell className="text-sm text-muted-foreground max-w-[300px] whitespace-normal leading-snug">
        {item.description}
      </TableCell>

      {/* Conf */}
      <TableCell className="text-center">
        <ConfBadge value={item.conf} />
      </TableCell>

      {/* Hours — editable */}
      <TableCell className="text-right">
        <HoursCell
          hours={item.hours}
          conf={item.conf}
          onSave={(val) => onHoursChange(item.id, val)}
        />
      </TableCell>

      {/* Low Hrs */}
      <TableCell className="text-right font-mono text-sm">
        {low}
      </TableCell>

      {/* High Hrs */}
      <TableCell className="text-right font-mono text-sm font-medium">
        {high}
      </TableCell>

      {/* Assumption Ref */}
      <TableCell className="text-xs text-muted-foreground max-w-[160px] whitespace-normal">
        {item.assumptionRef ?? "—"}
      </TableCell>
    </TableRow>
  )
}
