"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALLOWED_MODEL_OVERRIDES } from "@/lib/model-overrides"

interface ModelOverrideSelectProps {
  phaseId: string
  currentOverride: string | null | undefined
  disabled?: boolean
  onUpdated?: (newOverride: string | null) => void
}

export function ModelOverrideSelect({
  phaseId,
  currentOverride,
  disabled,
  onUpdated,
}: ModelOverrideSelectProps) {
  const [isPending, setIsPending] = React.useState(false)
  const [localOverride, setLocalOverride] = React.useState<string | null>(
    currentOverride ?? null
  )

  // Sync if parent prop changes (e.g. page refetch)
  React.useEffect(() => {
    setLocalOverride(currentOverride ?? null)
  }, [currentOverride])

  async function handleChange(value: string) {
    const newOverride = value === "" ? null : value
    setIsPending(true)
    try {
      const res = await fetch(`/api/phases/${phaseId}/model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelOverride: newOverride }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("[ModelOverrideSelect] PATCH failed:", err)
        return
      }
      setLocalOverride(newOverride)
      onUpdated?.(newOverride)
    } catch (err) {
      console.error("[ModelOverrideSelect] fetch error:", err)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <Select
        value={localOverride ?? ""}
        onValueChange={handleChange}
        disabled={disabled || isPending}
      >
        <SelectTrigger className="h-7 w-44 text-xs">
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <SelectValue placeholder="Default (auto)" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Default (auto)</SelectItem>
          {ALLOWED_MODEL_OVERRIDES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {localOverride && (
        <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
          Pinned
        </Badge>
      )}
    </div>
  )
}
