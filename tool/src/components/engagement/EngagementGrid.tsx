"use client"

import * as React from "react"
import { EngagementCard } from "@/components/engagement/EngagementCard"
import type { EngagementStatus, TechStack } from "@/generated/prisma/client"

interface EngagementItem {
  id: string
  clientName: string
  projectName?: string | null
  techStack: TechStack
  status: EngagementStatus
  workflowPath?: "NO_RESPONSE" | "HAS_RESPONSE" | null
  phaseProgress: { completed: number; total: number }
  updatedAt: Date
  costSummary?: { totalTokens: number; estimatedCostUsd: number; phasesRun: number } | null
  importSource?: string | null
}

interface EngagementGridProps {
  engagements: EngagementItem[]
}

export function EngagementGrid({ engagements }: EngagementGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {engagements.map((engagement) => (
        <EngagementCard key={engagement.id} {...engagement} />
      ))}
    </div>
  )
}
