"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { FileDown, Printer, Loader2, FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArtefactViewer } from "@/components/artefact/ArtefactViewer"
import { VersionSelector } from "@/components/artefact/VersionSelector"

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

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const [clientName, setClientName] = React.useState("")
  const [proposals, setProposals] = React.useState<ArtefactData[]>([])
  const [currentVersion, setCurrentVersion] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch engagement")
        return res.json() as Promise<EngagementResponse>
      })
      .then((data) => {
        setClientName(data.clientName)

        // Collect all PROPOSAL artefacts across phases, sorted by version
        const allProposals: ArtefactData[] = []
        for (const phase of data.phases) {
          for (const artefact of phase.artefacts) {
            if (artefact.artefactType === "PROPOSAL" && artefact.contentMd) {
              allProposals.push(artefact)
            }
          }
        }
        allProposals.sort((a, b) => a.version - b.version)
        setProposals(allProposals)

        if (allProposals.length > 0) {
          setCurrentVersion(allProposals[allProposals.length - 1].version)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const currentProposal = proposals.find((p) => p.version === currentVersion)
  const contentMd = currentProposal?.contentMd ?? ""
  const availableVersions = proposals.map((p) => p.version)

  function handlePrint() {
    window.print()
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

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <FileQuestion className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No proposal artefact found. Run Phase 1A to generate a technical proposal.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Technical Proposal
          </h2>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </div>

        {/* Actions — hidden when printing */}
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileDown className="mr-1.5 size-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 size-4" />
            Print
          </Button>
          {availableVersions.length > 1 && (
            <VersionSelector
              versions={availableVersions}
              currentVersion={currentVersion}
              onChange={setCurrentVersion}
            />
          )}
        </div>
      </div>

      <Separator />

      {/* Proposal content */}
      <ArtefactViewer contentMd={contentMd} version={currentVersion} />

      {/* Metadata card */}
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Generated:</span>
            <span className="text-xs font-medium">
              {currentProposal ? formatDate(currentProposal.createdAt) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Version:</span>
            <Badge variant="secondary" className="text-xs">
              v{currentVersion}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
