"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { CheckIcon, XIcon, ArrowRightIcon } from "lucide-react"

type AssumptionStatus = "ACTIVE" | "CONFIRMED" | "REJECTED" | "SUPERSEDED"

interface AssumptionActionsProps {
  assumptionId: string
  currentStatus: AssumptionStatus
  onStatusChange?: (id: string, newStatus: AssumptionStatus) => void
}

export function AssumptionActions({
  assumptionId,
  currentStatus,
  onStatusChange,
}: AssumptionActionsProps) {
  const [pending, setPending] = React.useState<AssumptionStatus | null>(null)

  function handleAction(newStatus: AssumptionStatus) {
    setPending(newStatus)
    // Simulate async update; replace with real API call
    setTimeout(() => {
      onStatusChange?.(assumptionId, newStatus)
      setPending(null)
    }, 400)
  }

  if (currentStatus !== "ACTIVE") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => handleAction("ACTIVE")}
        disabled={pending !== null}
      >
        Reactivate
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
        onClick={() => handleAction("CONFIRMED")}
        disabled={pending !== null}
      >
        <CheckIcon className="size-3" />
        Confirm
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
        onClick={() => handleAction("REJECTED")}
        disabled={pending !== null}
      >
        <XIcon className="size-3" />
        Reject
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800"
        onClick={() => handleAction("SUPERSEDED")}
        disabled={pending !== null}
      >
        <ArrowRightIcon className="size-3" />
        Supersede
      </Button>
    </div>
  )
}
