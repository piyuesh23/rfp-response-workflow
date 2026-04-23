/**
 * Accuracy drill-down page. Server component; joins live DB rows with the
 * latest ValidationReport.details JSON. Auth: owner or ADMIN.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  TRACKED_PHASES,
  computeOverallAccuracy,
  getLatestValidationReportsByPhase,
  scoreToStatus,
} from "@/lib/accuracy";
import { CONF_BUFFER } from "@/lib/ai/validators/conf-formula";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AccuracyDrilldown } from "@/components/accuracy/AccuracyDrilldown";
import { GapTable, type GapRow } from "@/components/accuracy/GapTable";
import {
  OrphanTable,
  type OrphanRow,
} from "@/components/accuracy/OrphanTable";
import {
  ConfViolationTable,
  type ConfViolationRow,
} from "@/components/accuracy/ConfViolationTable";
import {
  AssumptionDefectTable,
  RiskIssueTable,
  IntegrationTierIssueTable,
  ProposalObjectiveIssueTable,
  type AssumptionDefectRow,
  type RiskIssueRow,
  type IntegrationTierIssueRow,
  type ProposalObjectiveIssueRow,
} from "@/components/accuracy/DefectTables";
import { FixGapsButton } from "@/components/accuracy/FixGapsButton";

const TOR_REFERENCE_RX =
  /§\s*\d+|Section\s*\d+|Clause\s*\d+|Q&A\s*#?\d+|TOR\s*[§\d]/i;
const IMPACT_RX = /Impact\s*if\s*wrong[:\s]/i;
const VALID_TIERS = new Set(["T1", "T2", "T3"]);

function normalizeTask(task: string): string {
  return task.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function overlapScore(a: string, b: string): number {
  const at = new Set(a.split(" ").filter((w) => w.length > 2));
  const bt = new Set(b.split(" ").filter((w) => w.length > 2));
  if (at.size === 0 || bt.size === 0) return 0;
  let overlap = 0;
  for (const t of at) if (bt.has(t)) overlap += 1;
  return overlap / Math.min(at.size, bt.size);
}

function tierForScore(score: number): { barClass: string; textClass: string } {
  if (score >= 0.9) return { barClass: "bg-green-500", textClass: "text-green-600 dark:text-green-500" };
  if (score >= 0.75) return { barClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-500" };
  return { barClass: "bg-red-500", textClass: "text-red-600 dark:text-red-500" };
}

function statusBadgeVariant(status: "PASS" | "WARN" | "FAIL"): "default" | "secondary" | "destructive" {
  if (status === "PASS") return "default";
  if (status === "WARN") return "secondary";
  return "destructive";
}

export default async function AccuracyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    select: {
      id: true,
      clientName: true,
      projectName: true,
      createdById: true,
    },
  });

  if (!engagement) notFound();
  if (
    engagement.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    redirect(`/engagements/${id}`);
  }

  // ── Gather all per-section data in parallel ────────────────────────────────
  const [
    requirements,
    lineItems,
    assumptions,
    risks,
    reports,
  ] = await Promise.all([
    prisma.torRequirement.findMany({
      where: { engagementId: id },
      include: { lineItems: { select: { id: true } } },
      orderBy: { clauseRef: "asc" },
    }),
    prisma.lineItem.findMany({
      where: { engagementId: id },
      include: { torRefs: { select: { id: true } } },
      orderBy: [{ tab: "asc" }, { task: "asc" }],
    }),
    prisma.assumption.findMany({
      where: { engagementId: id, status: "ACTIVE" },
      select: {
        id: true,
        text: true,
        torReference: true,
        impactIfWrong: true,
        torRequirementRefs: { select: { id: true } },
      },
    }),
    prisma.riskRegisterEntry.findMany({
      where: { engagementId: id },
      select: {
        id: true,
        task: true,
        openQuestion: true,
        recommendedAction: true,
      },
    }),
    getLatestValidationReportsByPhase(id),
  ]);

  const overall = computeOverallAccuracy(reports);

  // ── Derive rows ────────────────────────────────────────────────────────────

  // Gaps: TorRequirements with zero linked LineItems
  const gaps: GapRow[] = requirements
    .filter((r) => r.lineItems.length === 0)
    .map((r) => ({
      id: r.id,
      clauseRef: r.clauseRef,
      title: r.title,
      domain: r.domain,
      clarityRating: r.clarityRating,
    }));

  // Orphans: LineItems w/ no torRefs AND no justification (task spec: show
  // only the unjustified ones; if justification present, filter out)
  const orphans: OrphanRow[] = lineItems
    .filter(
      (li) =>
        li.torRefs.length === 0 &&
        (!li.orphanJustification || li.orphanJustification.trim().length === 0)
    )
    .map((li) => ({
      id: li.id,
      tab: li.tab,
      task: li.task,
      hours: li.hours,
      justification: li.orphanJustification,
    }));

  // Conf formula violations: high != round(hours * (1 + buffer[conf]))
  const confViolations: ConfViolationRow[] = [];
  for (const li of lineItems) {
    const buffer = CONF_BUFFER[li.conf];
    if (buffer === undefined) continue;
    const expectedHigh = Math.round(li.hours * (1 + buffer));
    if (Math.abs(li.highHrs - expectedHigh) > 0.5) {
      confViolations.push({
        id: li.id,
        tab: li.tab,
        task: li.task,
        hours: li.hours,
        conf: li.conf,
        expectedHigh,
        actualHigh: li.highHrs,
        delta: li.highHrs - expectedHigh,
      });
    }
  }

  // Assumption defects
  const assumptionDefects: AssumptionDefectRow[] = [];
  for (const a of assumptions) {
    const missing: AssumptionDefectRow["missing"] = [];
    const hasTorRef =
      (a.torReference && a.torReference.trim().length > 0) ||
      a.torRequirementRefs.length > 0 ||
      TOR_REFERENCE_RX.test(a.text ?? "");
    if (!hasTorRef) missing.push("tor-reference");

    const hasImpact =
      (a.impactIfWrong && a.impactIfWrong.trim().length > 0) ||
      IMPACT_RX.test(a.text ?? "");
    if (!hasImpact) missing.push("impact-if-wrong");

    if (missing.length > 0) {
      const textPreview = (a.text ?? "").slice(0, 180);
      assumptionDefects.push({ id: a.id, textPreview, missing });
    }
  }

  // Risk register issues
  const riskIssues: RiskIssueRow[] = [];
  const riskByTask = new Map<
    string,
    { id: string; openQuestion: string; recommendedAction: string }
  >();
  for (const r of risks) {
    riskByTask.set(normalizeTask(r.task), {
      id: r.id,
      openQuestion: r.openQuestion ?? "",
      recommendedAction: r.recommendedAction ?? "",
    });
  }
  const lowConfItems = lineItems.filter((li) => li.conf <= 4);
  for (const li of lowConfItems) {
    const norm = normalizeTask(li.task);
    let match = riskByTask.get(norm);
    if (!match) {
      for (const [rTask, row] of riskByTask.entries()) {
        if (overlapScore(norm, rTask) >= 0.6) {
          match = row;
          break;
        }
      }
    }
    if (!match) {
      riskIssues.push({
        kind: "MISSING_ENTRY",
        id: li.id,
        task: li.task,
        conf: li.conf,
      });
    }
  }
  for (const r of risks) {
    if (!r.openQuestion || r.openQuestion.trim().length === 0) {
      riskIssues.push({
        kind: "BLANK_FIELD",
        id: r.id,
        task: r.task,
        missingField: "openQuestion",
      });
    }
    if (!r.recommendedAction || r.recommendedAction.trim().length === 0) {
      riskIssues.push({
        kind: "BLANK_FIELD",
        id: r.id,
        task: r.task,
        missingField: "recommendedAction",
      });
    }
  }

  // Integration tier issues: integration requirements without a tiered LineItem
  const integrationReqs = requirements.filter((r) => r.domain === "integration");
  const integrationTierIssues: IntegrationTierIssueRow[] = [];
  // Resolve live tier info per integration: need full LineItems for each req
  if (integrationReqs.length > 0) {
    const fullIntegrations = await prisma.torRequirement.findMany({
      where: { engagementId: id, domain: "integration" },
      include: {
        lineItems: {
          select: { id: true, integrationTier: true },
        },
      },
    });
    for (const req of fullIntegrations) {
      const tiered = req.lineItems.find(
        (li) => li.integrationTier && VALID_TIERS.has(li.integrationTier)
      );
      if (!tiered) {
        integrationTierIssues.push({
          kind: "NO_TIER",
          requirementId: req.id,
          clauseRef: req.clauseRef,
          title: req.title,
        });
      }
    }
  }

  // Surface proposal-tier miss from the Phase 5 ValidationReport.details
  // (we don't re-parse the proposal markdown here).
  const phase5 = reports["5"];
  type MissingReqEntry = { id: string; clauseRef: string; title: string };
  type ProposalMissEntry = { requirementId: string; title: string; estimateTier: string };
  // Phase 5 validator payloads may nest real fields under `.details`; merge both.
  type PO = { unmappedObjectives?: string[]; missingRequirements?: MissingReqEntry[] };
  type IT = { proposalMisses?: ProposalMissEntry[] };
  const phase5Raw = (phase5?.details ?? {}) as {
    integrationTier?: IT & { details?: IT };
    proposalObjective?: PO & { details?: PO };
  };
  const integrationTierResult: IT = { ...(phase5Raw.integrationTier ?? {}), ...(phase5Raw.integrationTier?.details ?? {}) };
  const proposalObjectiveResult: PO = { ...(phase5Raw.proposalObjective ?? {}), ...(phase5Raw.proposalObjective?.details ?? {}) };
  const proposalMisses: ProposalMissEntry[] = integrationTierResult.proposalMisses ?? [];
  for (const miss of proposalMisses) {
    integrationTierIssues.push({
      kind: "PROPOSAL_MISS",
      requirementId: miss.requirementId,
      clauseRef:
        integrationReqs.find((r) => r.id === miss.requirementId)?.clauseRef ?? "—",
      title: miss.title,
      estimateTier: miss.estimateTier,
    });
  }

  // Proposal objective issues (from Phase 5 details)
  const unmappedObjectives = proposalObjectiveResult.unmappedObjectives ?? [];
  const missingRequirements = proposalObjectiveResult.missingRequirements ?? [];
  const proposalObjectiveIssues: ProposalObjectiveIssueRow[] = [
    ...unmappedObjectives.map((preview, idx) => ({
      kind: "UNMAPPED_OBJECTIVE" as const,
      key: `unmapped-${idx}`,
      preview,
    })),
    ...missingRequirements.map((m) => ({
      kind: "MISSING_REQUIREMENT" as const,
      key: `missing-${m.id}`,
      preview: m.title,
      clauseRef: m.clauseRef,
    })),
  ];
  const proposalObjectiveNote = phase5
    ? undefined
    : "Phase 5 has not been run yet — proposal objective analysis is unavailable.";

  // ── Build tabs ─────────────────────────────────────────────────────────────
  // Tab labels are short; summary tile labels carry explicit phase ownership
  // (e.g. "Estimate Gaps (1A)") so users know which validator produced each
  // number.
  const tileLabelByValue: Record<string, string> = {
    gaps: "Estimate Gaps (1A)",
    orphans: "Estimate Orphans (1A)",
    conf: "Conf Violations (1A)",
    assumptions: "Assumption Defects (1A)",
    risks: "Risk Register (1A)",
    integrations: "Integration Tiers (1A + 5)",
    proposal: "Proposal Coverage (5)",
  };
  const tabs = [
    { value: "gaps", label: "Estimate Gaps", count: gaps.length, content: <GapTable gaps={gaps} /> },
    { value: "orphans", label: "Estimate Orphans", count: orphans.length, content: <OrphanTable orphans={orphans} /> },
    { value: "conf", label: "Conf Formula", count: confViolations.length, content: <ConfViolationTable violations={confViolations} /> },
    { value: "assumptions", label: "Assumptions", count: assumptionDefects.length, content: <AssumptionDefectTable defects={assumptionDefects} /> },
    { value: "risks", label: "Risk Register", count: riskIssues.length, content: <RiskIssueTable issues={riskIssues} /> },
    { value: "integrations", label: "Integration Tiers", count: integrationTierIssues.length, content: <IntegrationTierIssueTable issues={integrationTierIssues} /> },
    {
      value: "proposal",
      label: "Proposal Coverage",
      count: proposalObjectiveIssues.length,
      content: (
        <ProposalObjectiveIssueTable
          issues={proposalObjectiveIssues}
          note={proposalObjectiveNote}
        />
      ),
    },
  ];

  // Phase 5 summary block data — only shown when a Phase 5 ValidationReport
  // exists. Numbers come straight from the details JSON we already parsed
  // above; no extra query needed.
  const phase5Summary = phase5
    ? {
        status: scoreToStatus(phase5.accuracyScore),
        missingRequirements: missingRequirements.length,
        missingTiers: proposalMisses.length,
        unmappedObjectives: unmappedObjectives.length,
      }
    : null;

  const overallTier = overall ? tierForScore(overall.score) : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href={`/engagements/${id}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to engagement
        </Link>
        <span className="mx-1">/</span>
        <span className="text-foreground">
          {engagement.projectName ?? engagement.clientName}
        </span>
        <span className="mx-1">/</span>
        <span>Accuracy</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            Accuracy Report
          </h1>
          {overall && (
            <Badge variant={statusBadgeVariant(overall.status)}>
              {overall.status}
            </Badge>
          )}
        </div>

        {overall ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "font-mono text-4xl font-bold tabular-nums",
                  overallTier?.textClass
                )}
              >
                {Math.round(overall.score * 100)}%
              </span>
              <span className="text-sm text-muted-foreground">
                overall accuracy score
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  overallTier?.barClass
                )}
                style={{ width: `${Math.round(overall.score * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
              {TRACKED_PHASES.map((phase) => {
                const report = reports[phase];
                if (!report) return <span key={phase} className="opacity-60">Phase {phase}: —</span>;
                const status = scoreToStatus(report.accuracyScore);
                const ptier = tierForScore(report.accuracyScore);
                return (
                  <span key={phase} className="flex items-center gap-1">
                    Phase {phase}:
                    <span className={cn("font-mono font-semibold tabular-nums", ptier.textClass)}>
                      {Math.round(report.accuracyScore * 100)}%
                    </span>
                    <Badge variant={statusBadgeVariant(status)} className="text-[10px]">{status}</Badge>
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No validation reports yet. Drill-down data is sourced from the
            latest structured tables, which may be empty for legacy
            engagements.
          </p>
        )}
      </div>

      {/* Fix Gaps — only show when there is at least one validation report */}
      {overall && (
        <FixGapsButton
          engagementId={id}
          totalGaps={gaps.length + orphans.length + confViolations.length + riskIssues.length}
        />
      )}

      <Separator />

      {/* Summary counters — tile labels carry explicit phase ownership so the
          user can see at a glance which validator owns each number. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tabs.map((t) => (
          <div
            key={t.value}
            className="flex flex-col gap-1 rounded-lg border bg-card p-3 ring-1 ring-foreground/10"
          >
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tileLabelByValue[t.value] ?? t.label}
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums",
                t.count === 0
                  ? "text-green-600 dark:text-green-500"
                  : "text-destructive"
              )}
            >
              {t.count}
            </span>
          </div>
        ))}
      </div>

      <AccuracyDrilldown tabs={tabs} phase5={phase5Summary} />
    </div>
  );
}
