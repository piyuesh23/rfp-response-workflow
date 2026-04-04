"use client"

import * as React from "react"
import { PhaseCard, type PhaseCardData } from "@/components/phase/PhaseCard"
import { cn } from "@/lib/utils"

interface PhaseTimelineProps {
  phases: PhaseCardData[]
  onPhaseClick?: (phaseNumber: string) => void
  className?: string
}

export function PhaseTimeline({ phases, onPhaseClick, className }: PhaseTimelineProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {phases.map((phase, index) => (
        <div key={phase.phaseNumber} className="relative flex flex-col">
          {/* Vertical connector line above (except first) */}
          {index > 0 && (
            <div className="absolute left-[1.375rem] top-0 h-3 w-px bg-border" />
          )}

          <div
            className="pt-3 animate-fade-in"
            style={{ animationDelay: `${index * 60}ms`, opacity: 0 }}
          >
            <PhaseCard
              phase={phase}
              onClick={onPhaseClick}
            />
          </div>

          {/* Vertical connector line below (except last) */}
          {index < phases.length - 1 && (
            <div className="absolute left-[1.375rem] bottom-0 h-3 w-px bg-border" />
          )}
        </div>
      ))}
    </div>
  )
}
