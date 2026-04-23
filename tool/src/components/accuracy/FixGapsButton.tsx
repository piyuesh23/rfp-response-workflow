"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Wand2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressStream } from "@/components/phase/ProgressStream"
import { cn } from "@/lib/utils"

interface ScoreDelta {
  phaseNumber: string
  before: number
  after: number
}

interface FixGapsButtonProps {
  engagementId: string
  totalGaps: number
  className?: string
}

export function FixGapsButton({ engagementId, totalGaps, className }: FixGapsButtonProps) {
  const router = useRouter()
  const [state, setState] = React.useState<"idle" | "running" | "done" | "error">("idle")
  const [runId, setRunId] = React.useState<string | null>(null)
  const [deltas, setDeltas] = React.useState<ScoreDelta[] | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const disabled = totalGaps === 0 || state === "running"

  async function handleClick() {
    setState("running")
    setDeltas(null)
    setErrorMsg(null)
    setRunId(null)

    try {
      const res = await fetch(`/api/engagements/${engagementId}/fix-gaps`, {
        method: "POST",
      })
      if (res.status === 409) {
        // Already running — get the existing runId from response
        const body = await res.json()
        setRunId(body.runId ?? null)
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const { runId: newRunId } = await res.json()
      setRunId(newRunId)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start gap fix")
      setState("error")
    }
  }

  async function handleComplete() {
    if (!runId) return
    // Fetch the score delta from the run record
    try {
      const res = await fetch(`/api/engagements/${engagementId}/fix-gaps/${runId}`)
      if (res.ok) {
        const run = await res.json()
        const before = (run.scoresBefore ?? []) as Array<{ phaseNumber: string; accuracyScore: number }>
        const after = (run.scoresAfter ?? []) as Array<{ phaseNumber: string; accuracyScore: number }>
        const computed: ScoreDelta[] = before
          .map((b) => {
            const a = after.find((x) => x.phaseNumber === b.phaseNumber)
            return a ? { phaseNumber: b.phaseNumber, before: b.accuracyScore, after: a.accuracyScore } : null
          })
          .filter((d): d is ScoreDelta => d !== null && Math.abs(d.after - d.before) > 0.001)
        setDeltas(computed.length > 0 ? computed : null)
      }
    } catch {
      // Non-fatal — delta display is cosmetic
    }
    setState("done")
    router.refresh()
  }

  function handleError() {
    setState("error")
    setErrorMsg("Gap fix agent encountered an error. Check the logs above.")
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleClick}
          disabled={disabled}
          size="sm"
          variant={state === "done" ? "outline" : "default"}
          className="gap-2"
        >
          {state === "running" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          {state === "running" ? "Fixing gaps…" : state === "done" ? "Run again" : "Fix Gaps"}
        </Button>

        {totalGaps === 0 && state !== "running" && (
          <span className="text-xs text-green-600 dark:text-green-500 font-medium">No gaps to fix</span>
        )}

        {state === "done" && deltas && deltas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {deltas.map((d) => {
              const diff = Math.round((d.after - d.before) * 100)
              return (
                <span
                  key={d.phaseNumber}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ring-1",
                    diff > 0
                      ? "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800"
                      : "bg-muted text-muted-foreground ring-border"
                  )}
                >
                  Phase {d.phaseNumber}: {Math.round(d.before * 100)}% → {Math.round(d.after * 100)}%
                  {diff > 0 && <span className="ml-1 text-green-600 dark:text-green-400">(+{diff}pp)</span>}
                </span>
              )
            })}
          </div>
        )}

        {state === "done" && (!deltas || deltas.length === 0) && (
          <span className="text-xs text-muted-foreground">Score updated — reload to see latest</span>
        )}
      </div>

      {state === "error" && errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      {runId && state === "running" && (
        <ProgressStream
          phaseId={runId}
          sseUrl={`/api/engagements/${engagementId}/fix-gaps/${runId}/sse`}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
    </div>
  )
}
