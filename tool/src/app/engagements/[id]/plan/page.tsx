"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { FileDown, Loader2, FileQuestion, MapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"

interface ArtefactData {
  id: string
  artefactType: string
  version: number
  contentMd: string | null
  createdAt: string
}

interface Phase {
  phaseNumber: string
  artefacts: ArtefactData[]
}

interface EngagementResponse {
  id: string
  clientName: string
  phases: Phase[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ProjectPlanPage() {
  const { id } = useParams<{ id: string }>()
  const [clientName, setClientName] = React.useState("")
  const [planArtefact, setPlanArtefact] = React.useState<ArtefactData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch engagement")
        return res.json() as Promise<EngagementResponse>
      })
      .then((data) => {
        setClientName(data.clientName)

        // Find the most recent PROJECT_PLAN artefact across all phases
        let latestPlan: ArtefactData | null = null
        for (const phase of data.phases) {
          for (const artefact of phase.artefacts) {
            if (artefact.artefactType === "PROJECT_PLAN" && artefact.contentMd) {
              if (!latestPlan || artefact.version > latestPlan.version) {
                latestPlan = artefact
              }
            }
          }
        }
        setPlanArtefact(latestPlan)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      // Find Phase 5B
      const res = await fetch(`/api/engagements/${id}`)
      if (!res.ok) throw new Error("Failed to fetch engagement")
      const data = await res.json() as EngagementResponse
      const phase5B = data.phases.find((p) => p.phaseNumber === "5B")
      if (!phase5B) throw new Error("Phase 5B not found — ensure engagement was created with project plan phase")

      // Trigger Phase 5B run via phases API
      const runRes = await fetch(`/api/engagements/${id}/phases/${(phase5B as unknown as { id: string }).id}/run`, {
        method: "POST",
      })
      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Failed to start project plan generation")
      }

      // Reload after a delay to pick up the generated artefact
      setTimeout(() => window.location.reload(), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!planArtefact?.contentMd) return
    const blob = new Blob([planArtefact.contentMd], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `project-plan-${clientName.replace(/[^a-zA-Z0-9]/g, "-")}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!planArtefact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <FileQuestion className="size-8 text-muted-foreground/50" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium">No Project Plan found</p>
          <p className="text-sm text-muted-foreground">
            Generate a project plan after estimates and proposal are complete.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <MapIcon className="size-4 mr-1.5" />}
          {generating ? "Generating..." : "Generate Project Plan"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Project Plan
          </h2>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <FileDown className="mr-1.5 size-4" />
            Download .md
          </Button>
        </div>
      </div>

      <Separator />

      <ArtefactViewer contentMd={planArtefact.contentMd ?? ""} version={planArtefact.version} />

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Generated:</span>
            <span className="text-xs font-medium">{formatDate(planArtefact.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Version:</span>
            <Badge variant="secondary" className="text-xs">v{planArtefact.version}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
