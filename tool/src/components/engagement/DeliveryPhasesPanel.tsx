"use client"

import * as React from "react"
import { PlusIcon, Trash2, CheckCircle2, Circle, Loader2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryPhase {
  id: string
  ordinal: number
  name: string
  summary: string
  scopeBullets: string[]
  targetDurationWeeks: number | null
  sourceType: "AI_INFERRED" | "USER_EDITED" | "USER_DEFINED"
  status: "DRAFT" | "CONFIRMED"
}

interface DeliveryPhasesPanelProps {
  engagementId: string
  estimationMode: "BIG_BANG" | "PHASED" | "UNDECIDED"
  phase1Complete: boolean
  onModeChange?: () => void
}

// ─── Editable Phase Card ──────────────────────────────────────────────────────

interface PhaseCardProps {
  phase: DeliveryPhase
  onUpdate: (updates: Partial<DeliveryPhase>) => void
  onDelete: () => void
  confirmed: boolean
}

function PhaseCard({ phase, onUpdate, onDelete, confirmed }: PhaseCardProps) {
  const [bullets, setBullets] = React.useState(phase.scopeBullets.join("\n"))

  function handleBulletsBlur() {
    const parsed = bullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean)
    onUpdate({ scopeBullets: parsed, sourceType: "USER_EDITED" })
  }

  return (
    <Card className={confirmed ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground cursor-grab shrink-0" />
          <div className="flex-1 min-w-0">
            {confirmed ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium">{phase.name}</span>
              </div>
            ) : (
              <Input
                value={phase.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={() => onUpdate({ sourceType: "USER_EDITED" })}
                className="h-7 text-sm font-medium"
                placeholder="Phase name..."
              />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-xs">
              {phase.sourceType === "AI_INFERRED" ? "AI" : phase.sourceType === "USER_EDITED" ? "Edited" : "Manual"}
            </Badge>
            {!confirmed && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {confirmed ? (
          <>
            <p className="text-xs text-muted-foreground">{phase.summary}</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {phase.scopeBullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            {phase.targetDurationWeeks && (
              <span className="text-xs text-muted-foreground">{phase.targetDurationWeeks} weeks</span>
            )}
          </>
        ) : (
          <>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Summary</Label>
              <Textarea
                value={phase.summary}
                onChange={(e) => onUpdate({ summary: e.target.value })}
                rows={2}
                className="text-xs"
                placeholder="What will the client have at the end of this phase?"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Scope bullets (one per line)</Label>
              <Textarea
                value={bullets}
                onChange={(e) => setBullets(e.target.value)}
                onBlur={handleBulletsBlur}
                rows={3}
                className="text-xs font-mono"
                placeholder="Deliverable 1&#10;Deliverable 2&#10;Deliverable 3"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Target duration (weeks)</Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={phase.targetDurationWeeks ?? ""}
                onChange={(e) =>
                  onUpdate({
                    targetDurationWeeks: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="h-7 text-xs w-24"
                placeholder="e.g. 6"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function DeliveryPhasesPanel({
  engagementId,
  estimationMode,
  phase1Complete,
  onModeChange,
}: DeliveryPhasesPanelProps) {
  const [phases, setPhases] = React.useState<DeliveryPhase[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [inferring, setInferring] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const allConfirmed = phases.length > 0 && phases.every((p) => p.status === "CONFIRMED")

  async function loadPhases() {
    setLoading(true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}/delivery-phases`)
      if (res.ok) {
        const data = await res.json() as DeliveryPhase[]
        setPhases(data)
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (estimationMode === "PHASED") {
      loadPhases()
    }
  }, [engagementId, estimationMode])

  async function handleSetMode(mode: "BIG_BANG" | "PHASED") {
    setSaving(true)
    setError(null)
    try {
      await fetch(`/api/engagements/${engagementId}/delivery-phases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-mode", estimationMode: mode }),
      })
      onModeChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set mode")
    } finally {
      setSaving(false)
    }
  }

  async function handleRunInference() {
    setInferring(true)
    setError(null)
    try {
      // Find and trigger Phase 1B
      const phasesRes = await fetch(`/api/engagements/${engagementId}`)
      if (!phasesRes.ok) throw new Error("Failed to fetch engagement")
      const eng = await phasesRes.json() as { phases: Array<{ id: string; phaseNumber: string; status: string }> }
      const phase1B = eng.phases.find((p) => p.phaseNumber === "1B")
      if (!phase1B) throw new Error("Phase 1B not found — re-create engagement")

      const runRes = await fetch(`/api/phases/${phase1B.id}/run`, {
        method: "POST",
      })
      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Failed to start inference")
      }
      // Reload after a brief delay (or user can refresh)
      setTimeout(() => loadPhases(), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inference failed")
    } finally {
      setInferring(false)
    }
  }

  async function handleUpdatePhase(phaseId: string, updates: Partial<DeliveryPhase>) {
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)))
    try {
      await fetch(`/api/engagements/${engagementId}/delivery-phases/${phaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch {
      // optimistic update already applied
    }
  }

  async function handleDeletePhase(phaseId: string) {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId))
    try {
      await fetch(`/api/engagements/${engagementId}/delivery-phases/${phaseId}`, {
        method: "DELETE",
      })
    } catch {
      // non-fatal
    }
  }

  async function handleAddPhase() {
    const newPhase = await fetch(`/api/engagements/${engagementId}/delivery-phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Phase ${phases.length + 1}: New Phase`,
        summary: "",
        scopeBullets: [],
      }),
    })
    if (newPhase.ok) {
      const phase = await newPhase.json() as DeliveryPhase
      setPhases((prev) => [...prev, phase])
    }
  }

  async function handleConfirmAll() {
    setConfirming(true)
    setError(null)
    try {
      await fetch(`/api/engagements/${engagementId}/delivery-phases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm-all" }),
      })
      setPhases((prev) => prev.map((p) => ({ ...p, status: "CONFIRMED" as const })))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirmation failed")
    } finally {
      setConfirming(false)
    }
  }

  // UNDECIDED state — show mode selection
  if (estimationMode === "UNDECIDED") {
    if (!phase1Complete) {
      return (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Complete Phase 1 (TOR Assessment) to unlock the estimation approach selector.
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Choose your estimation approach</p>
          <p className="text-xs text-muted-foreground">Phase 1 analysis is complete. How should estimates be structured?</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => handleSetMode("BIG_BANG")}
            className="flex-1"
          >
            Big Bang
          </Button>
          <Button
            disabled={saving}
            onClick={() => handleSetMode("PHASED")}
            className="flex-1"
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Phased
          </Button>
        </div>
      </div>
    )
  }

  // BIG_BANG — nothing to show
  if (estimationMode === "BIG_BANG") {
    return null
  }

  // PHASED state
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Delivery Phases</p>
          <p className="text-xs text-muted-foreground">
            {phases.length === 0
              ? "No phases inferred yet."
              : allConfirmed
              ? `${phases.length} phases confirmed — estimates can now be generated.`
              : `${phases.length} phase(s) inferred — review and confirm to unlock estimates.`}
          </p>
        </div>
        {!allConfirmed && (
          <Button
            size="sm"
            variant={phases.length > 0 ? "outline" : "default"}
            disabled={inferring}
            onClick={handleRunInference}
          >
            {inferring ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {phases.length > 0 ? "Re-infer Phases (AI)" : "Infer Phases (AI)"}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading phases...
        </div>
      )}

      {phases.length > 0 && (
        <div className="flex flex-col gap-3">
          {phases.map((phase) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              confirmed={allConfirmed}
              onUpdate={(updates) => handleUpdatePhase(phase.id, updates)}
              onDelete={() => handleDeletePhase(phase.id)}
            />
          ))}

          {!allConfirmed && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={handleAddPhase}
              >
                <PlusIcon className="size-4 mr-1" /> Add Phase
              </Button>
              <Separator />
              <div className="flex justify-end">
                <Button
                  disabled={confirming || phases.length === 0}
                  onClick={handleConfirmAll}
                >
                  {confirming ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
                  Confirm Delivery Phases
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
