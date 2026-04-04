"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Play } from "lucide-react"
import { PHASE_LABELS } from "@/components/phase/PhaseCard"

const PHASE_DURATIONS: Record<string, string> = {
  "0": "3-8 minutes",
  "1": "2-5 minutes",
  "1A": "5-15 minutes",
  "2": "2-5 minutes",
  "3": "3-8 minutes",
  "4": "3-8 minutes",
  "5": "1-3 minutes",
}

interface RunPhaseButtonProps {
  phaseNumber: string
  onConfirm?: () => void
  disabled?: boolean
  className?: string
}

export function RunPhaseButton({
  phaseNumber,
  onConfirm,
  disabled = false,
  className,
}: RunPhaseButtonProps) {
  const [open, setOpen] = React.useState(false)
  const label = PHASE_LABELS[phaseNumber] ?? `Phase ${phaseNumber}`
  const duration = PHASE_DURATIONS[phaseNumber] ?? "a few minutes"

  function handleConfirm() {
    setOpen(false)
    onConfirm?.()
  }

  return (
    <>
      <Button
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Play className="size-4" />
        Run Phase {phaseNumber}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Run Phase {phaseNumber}: {label}?
            </DialogTitle>
            <DialogDescription>
              This will start AI analysis. The phase typically takes {duration}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" />
              }
            >
              Cancel
            </DialogClose>
            <Button onClick={handleConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
