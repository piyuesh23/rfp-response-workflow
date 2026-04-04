"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfBadgeProps {
  value: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CONF_CONFIG: Record<
  number,
  { description: string; buffer: number; colorClass: string }
> = {
  6: {
    description: "High clarity, no buffer",
    buffer: 0,
    colorClass: "bg-emerald-100 text-emerald-700",
  },
  5: {
    description: "Good clarity, +25% buffer",
    buffer: 25,
    colorClass: "bg-emerald-100 text-emerald-700",
  },
  4: {
    description: "Moderate clarity, +50% buffer",
    buffer: 50,
    colorClass: "bg-amber-100 text-amber-700",
  },
  3: {
    description: "Low clarity, +50% buffer",
    buffer: 50,
    colorClass: "bg-red-100 text-red-700",
  },
  2: {
    description: "Very low clarity, +75% buffer",
    buffer: 75,
    colorClass: "bg-red-100 text-red-700",
  },
  1: {
    description: "Unclear, +100% buffer",
    buffer: 100,
    colorClass: "bg-red-100 text-red-700",
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfBadge({ value, className }: ConfBadgeProps) {
  const config = CONF_CONFIG[value]
  const tooltipText =
    config.buffer === 0
      ? `Conf ${value}: ${config.description}. Buffer: none`
      : `Conf ${value}: ${config.description}. Buffer: +${config.buffer}%`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span
            className={cn(
              "inline-flex size-6 cursor-default items-center justify-center rounded-full text-xs font-semibold font-mono select-none",
              config.colorClass,
              className
            )}
          >
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { CONF_CONFIG }
