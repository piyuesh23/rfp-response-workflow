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

interface VersionSelectorProps {
  versions: number[]
  currentVersion: number
  onChange: (version: number) => void
}

export function VersionSelector({
  versions,
  currentVersion,
  onChange,
}: VersionSelectorProps) {
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
          {versions.map((v) => (
            <SelectItem key={v} value={String(v)}>
              v{v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="secondary">
        {versions.length} {versions.length === 1 ? "version" : "versions"}
      </Badge>
    </div>
  )
}
