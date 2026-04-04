"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface RiskBadgeProps {
  conf: number
  hoursAtRisk: number
  className?: string
}

type Severity = "High" | "Medium" | "Low"

function getSeverity(conf: number, hoursAtRisk: number): Severity {
  if (conf <= 2 || hoursAtRisk > 40) return "High"
  if (conf <= 4 || hoursAtRisk >= 16) return "Medium"
  return "Low"
}

const SEVERITY_CLASSES: Record<Severity, string> = {
  High: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  Low: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
}

export function RiskBadge({ conf, hoursAtRisk, className }: RiskBadgeProps) {
  const severity = getSeverity(conf, hoursAtRisk)
  const tooltipText = `Conf: ${conf}/6 · Hours at risk: ${hoursAtRisk}h`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="outline"
            className={cn(SEVERITY_CLASSES[severity], "cursor-default", className)}
          >
            {severity}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { getSeverity }
export type { Severity }
