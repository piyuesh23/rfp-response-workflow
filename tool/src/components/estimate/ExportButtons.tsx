"use client"

import { DownloadIcon, FileTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Component ───────────────────────────────────────────────────────────────

interface ExportButtonsProps {
  onDownloadExcel?: () => void
  onGenerateProposal?: () => void
}

export function ExportButtons({ onDownloadExcel, onGenerateProposal }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onDownloadExcel}>
        <DownloadIcon className="size-4" />
        Download Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onGenerateProposal}>
        <FileTextIcon className="size-4" />
        Generate Proposal
      </Button>
    </div>
  )
}
