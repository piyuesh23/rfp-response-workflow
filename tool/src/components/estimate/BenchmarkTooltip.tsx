"use client"

import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BenchmarkEntry {
  lowHours: number
  highHours: number
}

interface BenchmarkTooltipProps {
  taskType: string
  techStack: string
  children: React.ReactNode
}

// ─── Mock benchmark lookup ────────────────────────────────────────────────────
// In production this would query the Benchmark table via a server action or API.

const BENCHMARK_LOOKUP: Record<string, BenchmarkEntry> = {
  // content_architecture
  "Content Type — Simple (3–5 fields)": { lowHours: 4, highHours: 8 },
  "Content Type — Complex (10+ fields, paragraphs)": { lowHours: 12, highHours: 24 },
  "Taxonomy — per vocabulary": { lowHours: 2, highHours: 4 },
  // integrations
  "T1 Integration — Simple REST API (read-only)": { lowHours: 8, highHours: 16 },
  "T2 Integration — Bidirectional CRM Sync": { lowHours: 16, highHours: 32 },
  "T3 Integration — Complex ERP / Payment Gateway": { lowHours: 32, highHours: 60 },
  // migrations
  "Content Migration — per 100 nodes (simple)": { lowHours: 8, highHours: 16 },
  "Content Migration — per 100 nodes (complex)": { lowHours: 16, highHours: 32 },
  // frontend
  "Design System Setup": { lowHours: 24, highHours: 40 },
  "Header & Navigation Component": { lowHours: 16, highHours: 32 },
  "Hero Component": { lowHours: 8, highHours: 16 },
  "Card & Listing Grid": { lowHours: 12, highHours: 20 },
  // devops
  "Environment Setup (Dev/Stage/Prod)": { lowHours: 8, highHours: 16 },
  "CI/CD Pipeline Configuration": { lowHours: 8, highHours: 20 },
  "Headless Preview / ISR Setup": { lowHours: 12, highHours: 24 },
}

function lookupBenchmark(
  taskType: string,
  _techStack: string
): BenchmarkEntry | null {
  return BENCHMARK_LOOKUP[taskType] ?? null
}

// ─── Mini bar visualization ───────────────────────────────────────────────────

interface MiniBarProps {
  low: number
  high: number
  maxHours?: number
}

function MiniBar({ low, high, maxHours = 60 }: MiniBarProps) {
  const lowPct = Math.min((low / maxHours) * 100, 100)
  const highPct = Math.min((high / maxHours) * 100, 100)

  return (
    <div className="relative h-2 w-32 rounded-full bg-white/20 overflow-hidden">
      {/* low segment */}
      <div
        className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-400"
        style={{ width: `${lowPct}%` }}
      />
      {/* high extension */}
      {highPct > lowPct && (
        <div
          className="absolute inset-y-0 rounded-r-full bg-amber-400/70"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BenchmarkTooltip({
  taskType,
  techStack,
  children,
}: BenchmarkTooltipProps) {
  const benchmark = lookupBenchmark(taskType, techStack)

  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-2 py-2">
        {benchmark ? (
          <>
            <span className="text-[11px] font-medium text-background/80 uppercase tracking-wider">
              Benchmark
            </span>
            <div className="flex items-center gap-2">
              <MiniBar low={benchmark.lowHours} high={benchmark.highHours} />
              <span className="font-mono text-xs font-semibold">
                {benchmark.lowHours}–{benchmark.highHours} hrs
              </span>
            </div>
            <span className="text-[10px] text-background/60">
              {techStack} · {taskType}
            </span>
          </>
        ) : (
          <span className="text-xs text-background/70">No benchmark data</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
