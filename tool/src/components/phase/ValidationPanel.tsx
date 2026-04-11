"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface StructuralItem {
  category: string
  status: "PASS" | "WARN" | "FAIL"
  message: string
  details?: string[]
}

interface BenchmarkSummary {
  passCount: number
  warnCount: number
  failCount: number
  noBenchmarkCount: number
  totalItems: number
}

interface ProposalItem {
  category: string
  status: "PASS" | "WARN" | "FAIL"
  message: string
  expected?: number
  found?: number
}

interface EstimateValidation {
  type: "estimate"
  report: {
    benchmark: BenchmarkSummary & { items: unknown[] }
    structural: StructuralItem[]
    overallStatus: "PASS" | "WARN" | "FAIL"
  }
}

interface ProposalValidation {
  type: "proposal"
  report: {
    items: ProposalItem[]
    overallStatus: "PASS" | "WARN" | "FAIL"
  }
}

type ValidationResponse = EstimateValidation | ProposalValidation

interface ValidationPanelProps {
  phaseId: string
  phaseNumber: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PASS: <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />,
  WARN: <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />,
  FAIL: <XCircle className="size-3.5 text-red-600 dark:text-red-400" />,
}

const CATEGORY_LABELS: Record<string, string> = {
  ALWAYS_INCLUDE: "Required Tasks",
  ASSUMPTION_SOURCE: "Assumption Sources",
  RISK_REGISTER: "Risk Register Coverage",
  TAB_ORGANIZATION: "Tab Organization",
  ASSUMPTION_COVERAGE: "Assumptions Carry-Forward",
  RISK_COVERAGE: "Risk Carry-Forward",
  INTEGRATION_COVERAGE: "Integration Coverage",
  ARCHITECTURE_REFERENCE: "Architecture Alignment",
}

export function ValidationPanel({ phaseId, phaseNumber }: ValidationPanelProps) {
  const [data, setData] = React.useState<ValidationResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState(false)

  const isValidatable = phaseNumber === "1A" || phaseNumber === "3" || phaseNumber === "5"

  React.useEffect(() => {
    if (!isValidatable) {
      setLoading(false)
      return
    }

    fetch(`/api/phases/${phaseId}/validate`)
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result) {
          setData(result)
          // Auto-expand if there are failures
          const status = result.report?.overallStatus
          if (status === "FAIL") setExpanded(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [phaseId, isValidatable])

  if (!isValidatable || loading || !data) return null

  const overallStatus = data.report.overallStatus
  const { passCount, warnCount, failCount } = getStatusCounts(data)

  return (
    <div className={cn(
      "border-b",
      overallStatus === "FAIL" && "bg-red-50/50 dark:bg-red-950/20",
      overallStatus === "WARN" && "bg-amber-50/50 dark:bg-amber-950/20",
      overallStatus === "PASS" && "bg-green-50/50 dark:bg-green-950/20",
    )}>
      {/* Summary bar */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <span className="font-medium">Quality Checks</span>
        <span className="flex items-center gap-1.5 ml-1">
          {passCount > 0 && (
            <span className="flex items-center gap-0.5 text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-3" />
              {passCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              {warnCount}
            </span>
          )}
          {failCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-700 dark:text-red-400">
              <XCircle className="size-3" />
              {failCount}
            </span>
          )}
        </span>
        <span className="ml-auto text-muted-foreground">
          {overallStatus === "PASS" ? "All checks passed" : overallStatus === "WARN" ? "Warnings found" : "Issues found"}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          {data.type === "estimate" ? (
            <>
              {/* Structural checks */}
              {data.report.structural.map((item, i) => (
                <ValidationRow key={i} item={item} />
              ))}
              {/* Benchmark summary */}
              <div className="flex items-center gap-2 text-xs py-1">
                <Info className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Benchmarks: {data.report.benchmark.passCount} within range, {data.report.benchmark.warnCount} deviated (justified), {data.report.benchmark.failCount} deviated (unjustified), {data.report.benchmark.noBenchmarkCount} no benchmark
                </span>
              </div>
            </>
          ) : (
            <>
              {data.report.items.map((item, i) => (
                <ProposalRow key={i} item={item} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ValidationRow({ item }: { item: StructuralItem }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 py-0.5">
        {STATUS_ICON[item.status]}
        <span className="font-medium">{CATEGORY_LABELS[item.category] ?? item.category}</span>
        <span className="text-muted-foreground">{item.message}</span>
        {item.details && item.details.length > 0 && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-1 underline"
            onClick={() => setDetailsOpen((prev) => !prev)}
          >
            {detailsOpen ? "hide" : "details"}
          </button>
        )}
      </div>
      {detailsOpen && item.details && (
        <ul className="ml-7 mt-1 space-y-0.5 text-muted-foreground">
          {item.details.map((d, i) => (
            <li key={i}>- {d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProposalRow({ item }: { item: ProposalItem }) {
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      {STATUS_ICON[item.status]}
      <span className="font-medium">{CATEGORY_LABELS[item.category] ?? item.category}</span>
      <span className="text-muted-foreground">{item.message}</span>
      {item.expected !== undefined && item.found !== undefined && (
        <span className="text-muted-foreground ml-1">
          ({item.found}/{item.expected})
        </span>
      )}
    </div>
  )
}

function getStatusCounts(data: ValidationResponse): { passCount: number; warnCount: number; failCount: number } {
  if (data.type === "estimate") {
    const structural = data.report.structural
    return {
      passCount: structural.filter((s) => s.status === "PASS").length + (data.report.benchmark.failCount === 0 && data.report.benchmark.warnCount === 0 ? 1 : 0),
      warnCount: structural.filter((s) => s.status === "WARN").length + (data.report.benchmark.warnCount > 0 && data.report.benchmark.failCount === 0 ? 1 : 0),
      failCount: structural.filter((s) => s.status === "FAIL").length + (data.report.benchmark.failCount > 0 ? 1 : 0),
    }
  }

  return {
    passCount: data.report.items.filter((i) => i.status === "PASS").length,
    warnCount: data.report.items.filter((i) => i.status === "WARN").length,
    failCount: data.report.items.filter((i) => i.status === "FAIL").length,
  }
}
