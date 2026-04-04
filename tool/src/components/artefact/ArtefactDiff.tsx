"use client"

import * as React from "react"
import { Columns2Icon, AlignLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ArtefactDiffProps {
  oldContent: string
  newContent: string
  mode?: "unified" | "side-by-side"
}

type DiffLine =
  | { type: "unchanged"; text: string; oldNum: number; newNum: number }
  | { type: "removed"; text: string; oldNum: number; newNum: null }
  | { type: "added"; text: string; oldNum: null; newNum: number }

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")

  // LCS-based diff using Myers-style DP table
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = []
  let i = m
  let j = n
  let oldNum = m
  let newNum = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged", text: oldLines[i - 1], oldNum, newNum })
      i--
      j--
      oldNum--
      newNum--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: newLines[j - 1], oldNum: null, newNum })
      j--
      newNum--
    } else {
      result.push({ type: "removed", text: oldLines[i - 1], oldNum, newNum: null })
      i--
      oldNum--
    }
  }

  return result.reverse()
}

function LineNumber({ num }: { num: number | null }) {
  return (
    <span className="inline-block w-10 shrink-0 select-none pr-2 text-right font-mono text-xs text-muted-foreground/60">
      {num !== null ? num : ""}
    </span>
  )
}

const lineStyles: Record<DiffLine["type"], string> = {
  added: "bg-green-50 dark:bg-green-950/30",
  removed: "bg-red-50 dark:bg-red-950/30",
  unchanged: "",
}

const prefixMap: Record<DiffLine["type"], string> = {
  added: "+",
  removed: "-",
  unchanged: " ",
}

const prefixStyles: Record<DiffLine["type"], string> = {
  added: "text-green-600 dark:text-green-400",
  removed: "text-red-600 dark:text-red-400",
  unchanged: "text-muted-foreground/40",
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-full font-mono text-xs leading-5">
        {lines.map((line, idx) => (
          <div key={idx} className={cn("flex items-start px-2 py-px", lineStyles[line.type])}>
            <span className={cn("mr-1 w-3 shrink-0 select-none", prefixStyles[line.type])}>
              {prefixMap[line.type]}
            </span>
            <LineNumber num={line.oldNum} />
            <LineNumber num={line.newNum} />
            <span className="whitespace-pre-wrap break-all text-foreground">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SideBySideView({ lines }: { lines: DiffLine[] }) {
  // Build paired rows: each removed is paired with the next added when adjacent
  type PairedRow =
    | { left: DiffLine; right: DiffLine | null }
    | { left: null; right: DiffLine }

  const rows: PairedRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === "unchanged") {
      rows.push({ left: line, right: line })
      i++
    } else if (line.type === "removed") {
      const next = lines[i + 1]
      if (next?.type === "added") {
        rows.push({ left: line, right: next })
        i += 2
      } else {
        rows.push({ left: line, right: null })
        i++
      }
    } else {
      // added without preceding removed
      rows.push({ left: null, right: line })
      i++
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-full grid-cols-2 divide-x divide-border font-mono text-xs leading-5">
        {rows.map((row, idx) => {
          const left = row.left
          const right = row.right
          const leftType = left?.type ?? "unchanged"
          const rightType = right?.type ?? "unchanged"

          return (
            <React.Fragment key={idx}>
              {/* Left column */}
              <div
                className={cn(
                  "flex items-start px-2 py-px",
                  left
                    ? leftType === "removed"
                      ? "bg-red-50 dark:bg-red-950/30"
                      : leftType === "unchanged"
                        ? ""
                        : ""
                    : "bg-muted/30"
                )}
              >
                {left ? (
                  <>
                    <span
                      className={cn(
                        "mr-1 w-3 shrink-0 select-none",
                        prefixStyles[leftType]
                      )}
                    >
                      {prefixMap[leftType]}
                    </span>
                    <LineNumber num={left.oldNum} />
                    <span className="whitespace-pre-wrap break-all text-foreground">{left.text}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/30">{"·".repeat(3)}</span>
                )}
              </div>
              {/* Right column */}
              <div
                className={cn(
                  "flex items-start px-2 py-px",
                  right
                    ? rightType === "added"
                      ? "bg-green-50 dark:bg-green-950/30"
                      : rightType === "unchanged"
                        ? ""
                        : ""
                    : "bg-muted/30"
                )}
              >
                {right ? (
                  <>
                    <span
                      className={cn(
                        "mr-1 w-3 shrink-0 select-none",
                        prefixStyles[rightType]
                      )}
                    >
                      {prefixMap[rightType]}
                    </span>
                    <LineNumber num={right.newNum} />
                    <span className="whitespace-pre-wrap break-all text-foreground">{right.text}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/30">{"·".repeat(3)}</span>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function ArtefactDiff({
  oldContent,
  newContent,
  mode: modeProp = "unified",
}: ArtefactDiffProps) {
  const [mode, setMode] = React.useState<"unified" | "side-by-side">(modeProp)

  const lines = React.useMemo(
    () => computeDiff(oldContent, newContent),
    [oldContent, newContent]
  )

  const added = lines.filter((l) => l.type === "added").length
  const removed = lines.filter((l) => l.type === "removed").length

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-green-600 dark:text-green-400">+{added}</span>
          <span className="font-medium text-red-600 dark:text-red-400">-{removed}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "unified" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setMode("unified")}
            title="Unified view"
          >
            <AlignLeftIcon className="size-4" />
            <span className="sr-only">Unified</span>
          </Button>
          <Button
            variant={mode === "side-by-side" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setMode("side-by-side")}
            title="Side-by-side view"
          >
            <Columns2Icon className="size-4" />
            <span className="sr-only">Side by side</span>
          </Button>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-auto max-h-[600px]">
        {mode === "unified" ? (
          <UnifiedView lines={lines} />
        ) : (
          <SideBySideView lines={lines} />
        )}
      </div>
    </div>
  )
}
