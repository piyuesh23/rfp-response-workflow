"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CONF_CONFIG } from "./ConfBadge"

// ─── Types ───────────────────────────────────────────────────────────────────

interface HoursCellProps {
  hours: number
  conf: 1 | 2 | 3 | 4 | 5 | 6
  onSave: (newHours: number) => void
  className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HoursCell({ hours, conf, onSave, className }: HoursCellProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(hours))
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) {
      setDraft(String(hours))
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, hours])

  function commit() {
    const parsed = parseFloat(draft)
    if (!isNaN(parsed) && parsed >= 0) {
      onSave(parsed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") setEditing(false)
  }

  const bufferPct = CONF_CONFIG[conf].buffer / 100
  const lowHrs = hours
  const highHrs = Math.round(hours * (1 + bufferPct) * 10) / 10

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <Input
          ref={inputRef}
          type="number"
          min={0}
          step={0.5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="h-7 w-20 font-mono text-right text-sm"
        />
        <span className="text-[10px] text-muted-foreground font-mono">
          {lowHrs}–{highHrs} hrs
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={cn(
        "group flex flex-col items-end gap-0.5 rounded px-1.5 py-0.5 text-right transition-colors hover:bg-muted/60 cursor-pointer",
        className
      )}
    >
      <span className="font-mono text-sm font-medium">{hours}</span>
      <span className="text-[10px] text-muted-foreground font-mono opacity-0 transition-opacity group-hover:opacity-100">
        click to edit
      </span>
    </button>
  )
}
