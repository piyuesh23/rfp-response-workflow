"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, ChevronDownIcon, CopyIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface CitedSource {
  id: string
  sourceType: string
  sourceId: string
  snippet: string
  label: string
}

interface ChatSourcesListProps {
  sources: CitedSource[]
  engagementId?: string
}

function sourceHref(
  s: CitedSource,
  engagementId?: string
): string | null {
  if (!engagementId) return null
  if (s.sourceType === "REQUIREMENT") {
    return `/engagements/${engagementId}/accuracy`
  }
  if (s.sourceType === "ARTEFACT") {
    // Best-effort: phaseNumber may be embedded in the snippet's parent metadata.
    // Since we don't always have it, link to the engagement root.
    return `/engagements/${engagementId}`
  }
  return null
}

export function ChatSourcesList({ sources, engagementId }: ChatSourcesListProps) {
  const [open, setOpen] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  if (!sources.length) return null

  const handleCopy = async (source: CitedSource, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(source.snippet)
      setCopiedId(source.id)
      setTimeout(() => {
        setCopiedId((current) => (current === source.id ? null : current))
      }, 1500)
    } catch {
      // Clipboard may be unavailable (insecure context); silently ignore.
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronDownIcon
          className={cn(
            "size-3 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </button>

      {open && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {sources.map((s) => {
            const href = sourceHref(s, engagementId)
            const isCopied = copiedId === s.id
            const pill = (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground">
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {s.sourceType}
                </Badge>
                <span className="truncate" title={s.label}>
                  {s.label || s.sourceType}
                </span>
              </span>
            )
            return (
              <li key={s.id} className="flex max-w-full items-center gap-1">
                {href ? (
                  <Link
                    href={href}
                    className="min-w-0 max-w-full hover:opacity-80"
                    title={s.snippet}
                  >
                    {pill}
                  </Link>
                ) : (
                  <span className="min-w-0 max-w-full" title={s.snippet}>
                    {pill}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={isCopied ? "Copied snippet" : "Copy snippet"}
                  onClick={(event) => handleCopy(s, event)}
                >
                  {isCopied ? (
                    <CheckIcon className="size-3 text-primary" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
