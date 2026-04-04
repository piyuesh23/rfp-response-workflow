"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SearchFilterProps {
  searchValue: string
  statusValue: string | null
  techStackValue: string | null
  onSearchChange: (value: string) => void
  onStatusChange: (value: string | null) => void
  onTechStackChange: (value: string | null) => void
}

export function SearchFilter({
  searchValue,
  statusValue,
  techStackValue,
  onSearchChange,
  onStatusChange,
  onTechStackChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search engagements..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Select value={statusValue} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={techStackValue} onValueChange={onTechStackChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Tech Stacks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tech Stacks</SelectItem>
            <SelectItem value="DRUPAL">Drupal</SelectItem>
            <SelectItem value="DRUPAL_NEXTJS">Drupal + Next.js</SelectItem>
            <SelectItem value="NEXTJS">Next.js</SelectItem>
            <SelectItem value="REACT">React</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
