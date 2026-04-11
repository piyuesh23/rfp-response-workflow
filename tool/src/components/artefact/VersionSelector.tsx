"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface VersionInfo {
  version: number
  label?: string | null
}

interface VersionSelectorProps {
  versions: number[]
  versionLabels?: VersionInfo[]
  currentVersion: number
  onChange: (version: number) => void
}

export function VersionSelector({
  versions,
  versionLabels,
  currentVersion,
  onChange,
}: VersionSelectorProps) {
  const labelMap = new Map(versionLabels?.map((v) => [v.version, v.label]) ?? [])

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(currentVersion)}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => {
            const label = labelMap.get(v)
            return (
              <SelectItem key={v} value={String(v)}>
                v{v}{label ? ` — ${label}` : ""}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <Badge variant="secondary">
        {versions.length} {versions.length === 1 ? "version" : "versions"}
      </Badge>
    </div>
  )
}
