"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X } from "lucide-react";
import { MetricCard } from "@/components/charts/MetricCard";
import { OutcomePieChart } from "@/components/charts/OutcomePieChart";
import { LossReasonsChart } from "@/components/charts/LossReasonsChart";
import { DealValueTimeline } from "@/components/charts/DealValueTimeline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseInfo {
  phaseNumber: string;
  status: string;
}

interface Engagement {
  id: string;
  clientName: string;
  projectName: string | null;
  techStack: string;
  engagementType: string;
  status: string;
  outcome: string | null;
  estimatedDealValue: number | null;
  actualContractValue: number | null;
  dealCurrency: string | null;
  importSource: string | null;
  createdAt: string;
  phases: PhaseInfo[];
}

interface Account {
  id: string;
  canonicalName: string;
  industry: string;
  region: string | null;
  accountTier: string | null;
  primaryContact: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  engagements: Engagement[];
}

interface AnalyticsSummary {
  totalEngagements: number;
  winRate: number | null;
  outcomesRecorded: number;
  totalPipelineValue: number;
  wonRevenue: number;
  avgDealSize: number;
  totalAiCostUsd: number;
  totalTokensUsed: number;
  phasesRun: number;
  firstEngagement: string | null;
  lastEngagement: string | null;
}

interface AccountAnalytics {
  summary: AnalyticsSummary;
  outcomes: Record<string, number>;
  lossReasons: Record<string, number>;
  competitors: { name: string; count: number }[];
  techStackDistribution: Record<string, number>;
  engagementTypeDistribution: Record<string, number>;
  timeline: Engagement[];
  financial: {
    byQuarter: { quarter: string; pipelineValue: number; wonValue: number; engagementCount: number }[];
    byType: { type: string; totalValue: number; avgValue: number; count: number }[];
  };
  aiInvestment: {
    totalCostUsd: number;
    totalTokens: number;
    byPhase: { phaseNumber: string; count: number; avgCost: number; totalCost: number }[];
  };
}

type TabId = "overview" | "engagements" | "winloss" | "financial" | "details";

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const industryLabels: Record<string, string> = {
  HEALTHCARE: "Healthcare",
  FINTECH: "Fintech",
  EDUCATION: "Education",
  GOVERNMENT: "Government",
  MEDIA: "Media",
  ECOMMERCE: "E-Commerce",
  NONPROFIT: "Nonprofit",
  MANUFACTURING: "Manufacturing",
  PROFESSIONAL_SERVICES: "Professional Services",
  TECHNOLOGY: "Technology",
  ENERGY: "Energy",
  LEGAL: "Legal",
  OTHER: "Other",
};

const regionLabels: Record<string, string> = {
  NA: "North America",
  EMEA: "EMEA",
  APAC: "Asia Pacific",
  LATAM: "Latin America",
};

const tierLabels: Record<string, string> = {
  ENTERPRISE: "Enterprise",
  MID_MARKET: "Mid-Market",
  SMB: "SMB",
};

const techStackLabels: Record<string, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  WORDPRESS: "WordPress",
  WORDPRESS_NEXTJS: "WordPress + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
};

const engagementTypeLabels: Record<string, string> = {
  NEW_BUILD: "New Build",
  MIGRATION: "Migration",
  REDESIGN: "Redesign",
  ENHANCEMENT: "Enhancement",
  DISCOVERY: "Discovery",
};

const outcomeLabels: Record<string, string> = {
  WON: "Won",
  LOST: "Lost",
  NO_DECISION: "No Decision",
  WITHDRAWN: "Withdrawn",
  PARTIAL_WIN: "Partial Win",
  DEFERRED: "Deferred",
  NOT_SUBMITTED: "Not Submitted",
};

const lossReasonLabels: Record<string, string> = {
  PRICE_TOO_HIGH: "Price Too High",
  SCOPE_MISMATCH: "Scope Mismatch",
  COMPETITOR_PREFERRED: "Competitor Preferred",
  TIMELINE_MISMATCH: "Timeline Mismatch",
  BUDGET_CUT: "Budget Cut",
  RELATIONSHIP: "Relationship",
  TECHNICAL_FIT: "Technical Fit",
  NO_DECISION_MADE: "No Decision Made",
  OTHER: "Other",
};

const INDUSTRY_OPTIONS = [
  "HEALTHCARE",
  "FINTECH",
  "EDUCATION",
  "GOVERNMENT",
  "MEDIA",
  "ECOMMERCE",
  "NONPROFIT",
  "MANUFACTURING",
  "PROFESSIONAL_SERVICES",
  "TECHNOLOGY",
  "ENERGY",
  "LEGAL",
  "OTHER",
];

const OUTCOME_OPTIONS = [
  "WON",
  "LOST",
  "NO_DECISION",
  "WITHDRAWN",
  "PARTIAL_WIN",
  "DEFERRED",
  "NOT_SUBMITTED",
];

const LOSS_REASON_OPTIONS = [
  "PRICE_TOO_HIGH",
  "SCOPE_MISMATCH",
  "COMPETITOR_PREFERRED",
  "TIMELINE_MISMATCH",
  "BUDGET_CUT",
  "RELATIONSHIP",
  "TECHNICAL_FIT",
  "NO_DECISION_MADE",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number | null, currency?: string | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyK(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function outcomeVariant(
  outcome: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (outcome) {
    case "WON":
    case "PARTIAL_WIN":
      return "default";
    case "LOST":
      return "destructive";
    case "NO_DECISION":
    case "WITHDRAWN":
    case "DEFERRED":
    case "NOT_SUBMITTED":
      return "outline";
    default:
      return "secondary";
  }
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "IN_PROGRESS":
      return "secondary";
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  renderValue?: (val: string) => React.ReactNode;
  children?: (val: string, setVal: (v: string) => void) => React.ReactNode;
}

function EditableField({ label, value, onSave, renderValue, children }: EditableFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  async function handleSave() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          {children ? (
            children(draft, setDraft)
          ) : (
            <Input
              className="h-7 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleSave} disabled={saving}>
            <Check className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleCancel} disabled={saving}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 group">
          <span className="text-sm">
            {renderValue ? renderValue(value) : value || "—"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome recording dialog
// ---------------------------------------------------------------------------

interface OutcomeDialogProps {
  engagement: Engagement;
  onRecorded: (updated: Engagement) => void;
}

function OutcomeDialog({ engagement, onRecorded }: OutcomeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState("");
  const [lossReason, setLossReason] = React.useState("");
  const [competitor, setCompetitor] = React.useState("");
  const [contractValue, setContractValue] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function resetForm() {
    setOutcome("");
    setLossReason("");
    setCompetitor("");
    setContractValue("");
    setFeedback("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { outcome };
      if (lossReason) body.lossReason = lossReason;
      if (competitor) body.competitorWhoWon = competitor;
      if (contractValue) body.actualContractValue = parseFloat(contractValue);
      if (feedback) body.outcomeFeedback = feedback;

      const res = await fetch(`/api/engagements/${engagement.id}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to record outcome");
        return;
      }
      const updated = await res.json() as Engagement;
      onRecorded({ ...engagement, ...updated });
      setOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Record Outcome
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Outcome</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {engagement.clientName}
            {engagement.projectName ? ` — ${engagement.projectName}` : ""}
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Outcome</label>
            <Select value={outcome} onValueChange={(v) => { if (v) setOutcome(v); }}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {outcomeLabels[opt] ?? opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {outcome === "LOST" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Loss Reason</label>
              <Select value={lossReason} onValueChange={(v) => { if (v) setLossReason(v); }}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {lossReasonLabels[opt] ?? opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Competitor Who Won{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              className="h-8"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="e.g. Acquia, WP Engine..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Actual Contract Value{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              className="h-8"
              type="number"
              min="0"
              step="0.01"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="e.g. 150000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Feedback Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              className="h-8"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Key learnings, client feedback..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={saving || !outcome}>
              {saving ? "Saving..." : "Save Outcome"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

interface TabNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "engagements", label: "Engagements" },
  { id: "winloss", label: "Win / Loss" },
  { id: "financial", label: "Financial" },
  { id: "details", label: "Details" },
];

function TabNav({ active, onChange }: TabNavProps) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  account: Account;
  analytics: AccountAnalytics | null;
  analyticsLoading: boolean;
}

function OverviewTab({ analytics, analyticsLoading }: OverviewTabProps) {
  if (analyticsLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading analytics...</p>;
  }

  if (!analytics) {
    return <EmptyState message="No analytics available" />;
  }

  const { summary } = analytics;

  const recentEngagements = analytics.timeline.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 6 metric cards in 2x3 grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Engagements"
          value={summary.totalEngagements}
          subtitle={summary.firstEngagement ? `Since ${formatDate(summary.firstEngagement)}` : undefined}
        />
        <MetricCard
          label="Win Rate"
          value={summary.winRate != null ? `${Math.round(summary.winRate)}%` : "—"}
          subtitle={`${summary.outcomesRecorded} outcomes recorded`}
        />
        <MetricCard
          label="Total Pipeline"
          value={summary.totalPipelineValue > 0 ? formatCurrencyK(summary.totalPipelineValue) : "—"}
        />
        <MetricCard
          label="Won Revenue"
          value={summary.wonRevenue > 0 ? formatCurrencyK(summary.wonRevenue) : "—"}
          className="text-green-700 dark:text-green-300"
        />
        <MetricCard
          label="Avg Deal Size"
          value={summary.avgDealSize > 0 ? formatCurrencyK(summary.avgDealSize) : "—"}
        />
        <MetricCard
          label="AI Cost Spent"
          value={summary.totalAiCostUsd > 0 ? `$${summary.totalAiCostUsd.toFixed(2)}` : "—"}
          subtitle={summary.totalTokensUsed > 0 ? `${formatTokens(summary.totalTokensUsed)} tokens · ${summary.phasesRun} phases` : undefined}
        />
      </div>

      {/* Recent engagements */}
      {recentEngagements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentEngagements.map((eng) => (
              <div
                key={eng.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{eng.clientName}</span>
                    {eng.projectName && (
                      <span className="text-xs text-muted-foreground truncate">— {eng.projectName}</span>
                    )}
                    {eng.importSource && (
                      <Badge variant="outline" className="text-xs shrink-0">Imported</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {techStackLabels[eng.techStack] ?? eng.techStack}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(eng.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {eng.estimatedDealValue != null && (
                    <span className="text-xs text-muted-foreground">
                      {formatCurrencyK(eng.estimatedDealValue)}
                    </span>
                  )}
                  {eng.outcome ? (
                    <Badge variant={outcomeVariant(eng.outcome)} className="text-xs">
                      {outcomeLabels[eng.outcome] ?? eng.outcome}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {eng.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Engagements tab
// ---------------------------------------------------------------------------

interface EngagementsTabProps {
  engagements: Engagement[];
  onEngagementUpdated: (updated: Engagement) => void;
}

function EngagementsTab({ engagements, onEngagementUpdated }: EngagementsTabProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {engagements.length} engagement{engagements.length !== 1 ? "s" : ""} linked to this account
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Tech Stack</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Deal Value</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No engagements linked to this account
                </TableCell>
              </TableRow>
            ) : (
              engagements.map((eng) => (
                <TableRow key={eng.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{eng.clientName}</div>
                      {eng.projectName && (
                        <div className="text-xs text-muted-foreground truncate">{eng.projectName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {techStackLabels[eng.techStack] ?? eng.techStack}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {engagementTypeLabels[eng.engagementType] ?? eng.engagementType}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(eng.status)} className="text-xs">
                      {eng.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {eng.outcome ? (
                      <Badge variant={outcomeVariant(eng.outcome)} className="text-xs">
                        {outcomeLabels[eng.outcome] ?? eng.outcome}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCurrency(eng.estimatedDealValue, eng.dealCurrency)}
                  </TableCell>
                  <TableCell>
                    {eng.importSource ? (
                      <Badge variant="outline" className="text-xs">Imported</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(eng.createdAt)}
                  </TableCell>
                  <TableCell>
                    {eng.outcome == null && (
                      <OutcomeDialog engagement={eng} onRecorded={onEngagementUpdated} />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Win/Loss tab
// ---------------------------------------------------------------------------

interface WinLossTabProps {
  analytics: AccountAnalytics | null;
  analyticsLoading: boolean;
}

function WinLossTab({ analytics, analyticsLoading }: WinLossTabProps) {
  if (analyticsLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading analytics...</p>;
  }
  if (!analytics) {
    return <EmptyState message="No analytics available" />;
  }

  const hasOutcomes = Object.values(analytics.outcomes).some((v) => v > 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Outcome pie */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-base font-medium">Outcome Distribution</h3>
          {hasOutcomes ? (
            <OutcomePieChart data={analytics.outcomes} />
          ) : (
            <EmptyState message="No outcomes recorded yet" />
          )}
        </div>

        {/* Loss reasons */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-base font-medium">Loss Reasons</h3>
          <LossReasonsChart data={analytics.lossReasons} />
        </div>
      </div>

      {/* Competitors */}
      {analytics.competitors.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-base font-medium">Competitors</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Competitor</TableHead>
                  <TableHead className="text-right text-xs">Times Won Against Us</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.competitors.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="text-right text-sm">{c.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial tab
// ---------------------------------------------------------------------------

interface FinancialTabProps {
  analytics: AccountAnalytics | null;
  analyticsLoading: boolean;
}

function FinancialTab({ analytics, analyticsLoading }: FinancialTabProps) {
  if (analyticsLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading analytics...</p>;
  }
  if (!analytics) {
    return <EmptyState message="No analytics available" />;
  }

  const { financial, summary } = analytics;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Pipeline"
          value={summary.totalPipelineValue > 0 ? formatCurrencyK(summary.totalPipelineValue) : "—"}
        />
        <MetricCard
          label="Won Revenue"
          value={summary.wonRevenue > 0 ? formatCurrencyK(summary.wonRevenue) : "—"}
        />
        <MetricCard
          label="Avg Deal Size"
          value={summary.avgDealSize > 0 ? formatCurrencyK(summary.avgDealSize) : "—"}
        />
      </div>

      {/* Deal value timeline */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-base font-medium">Deal Value by Quarter</h3>
        <DealValueTimeline data={financial.byQuarter} />
      </div>

      {/* By engagement type */}
      {financial.byType.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-base font-medium">By Engagement Type</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-right text-xs">Count</TableHead>
                  <TableHead className="text-right text-xs">Total Value</TableHead>
                  <TableHead className="text-right text-xs">Avg Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financial.byType.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      {engagementTypeLabels[row.type] ?? row.type}
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.count}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.totalValue > 0 ? formatCurrencyK(row.totalValue) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.avgValue > 0 ? formatCurrencyK(row.avgValue) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details tab (edit form)
// ---------------------------------------------------------------------------

interface DetailsTabProps {
  account: Account;
  onPatch: (fields: Record<string, unknown>) => Promise<void>;
}

function DetailsTab({ account, onPatch }: DetailsTabProps) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <h2 className="text-base font-medium">Account Details</h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        <EditableField
          label="Account Name"
          value={account.canonicalName}
          onSave={(v) => onPatch({ canonicalName: v })}
        />

        <EditableField
          label="Industry"
          value={account.industry}
          onSave={(v) => onPatch({ industry: v })}
          renderValue={(v) => industryLabels[v] ?? v}
        >
          {(draft, setDraft) => (
            <Select value={draft} onValueChange={(v) => { if (v) setDraft(v); }}>
              <SelectTrigger className="h-7 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {industryLabels[opt] ?? opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </EditableField>

        <EditableField
          label="Tier"
          value={account.accountTier ?? ""}
          onSave={(v) => onPatch({ accountTier: v || null })}
          renderValue={(v) => (v ? (tierLabels[v] ?? v) : "—")}
        >
          {(draft, setDraft) => (
            <Select value={draft} onValueChange={(v) => { if (v) setDraft(v); }}>
              <SelectTrigger className="h-7 text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                <SelectItem value="MID_MARKET">Mid-Market</SelectItem>
                <SelectItem value="SMB">SMB</SelectItem>
              </SelectContent>
            </Select>
          )}
        </EditableField>

        <EditableField
          label="Region"
          value={account.region ?? ""}
          onSave={(v) => onPatch({ region: v || null })}
          renderValue={(v) => (v ? (regionLabels[v] ?? v) : "—")}
        >
          {(draft, setDraft) => (
            <Select value={draft} onValueChange={(v) => { if (v) setDraft(v); }}>
              <SelectTrigger className="h-7 text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NA">North America</SelectItem>
                <SelectItem value="EMEA">EMEA</SelectItem>
                <SelectItem value="APAC">Asia Pacific</SelectItem>
                <SelectItem value="LATAM">Latin America</SelectItem>
              </SelectContent>
            </Select>
          )}
        </EditableField>

        <EditableField
          label="Primary Contact"
          value={account.primaryContact ?? ""}
          onSave={(v) => onPatch({ primaryContact: v || null })}
        />

        <EditableField
          label="Contact Email"
          value={account.contactEmail ?? ""}
          onSave={(v) => onPatch({ contactEmail: v || null })}
        />

        <EditableField
          label="Notes"
          value={account.notes ?? ""}
          onSave={(v) => onPatch({ notes: v || null })}
        />
      </div>
      <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
        <p>Created {formatDate(account.createdAt)}</p>
        <p>Last updated {formatDate(account.updatedAt)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [account, setAccount] = React.useState<Account | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");
  const [analytics, setAnalytics] = React.useState<AccountAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/accounts/${id}`)
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
        return res.json() as Promise<Account>;
      })
      .then(setAccount)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load account")
      )
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch analytics when overview, winloss, or financial tabs are active
  React.useEffect(() => {
    if (!analyticsLoaded && (activeTab === "overview" || activeTab === "winloss" || activeTab === "financial")) {
      setAnalyticsLoading(true);
      fetch(`/api/accounts/${id}/analytics`)
        .then((res) => {
          if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
          return res.json() as Promise<AccountAnalytics>;
        })
        .then((data) => {
          setAnalytics(data);
          setAnalyticsLoaded(true);
        })
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }
  }, [id, activeTab, analyticsLoaded]);

  async function patchAccount(fields: Record<string, unknown>) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Failed to update account");
    }
    const updated = await res.json() as Account;
    setAccount((prev) => prev ? { ...prev, ...updated } : prev);
  }

  function handleEngagementUpdated(updated: Engagement) {
    setAccount((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        engagements: prev.engagements.map((e) =>
          e.id === updated.id ? { ...e, ...updated } : e
        ),
      };
    });
    // Invalidate analytics so it reloads
    setAnalyticsLoaded(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">Loading account...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm text-destructive">{error ?? "Account not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">{account.canonicalName}</h1>
        <p className="text-sm text-muted-foreground">
          {account.engagements.length} engagement{account.engagements.length !== 1 ? "s" : ""}
          {account.industry ? ` · ${industryLabels[account.industry] ?? account.industry}` : ""}
          {account.accountTier ? ` · ${tierLabels[account.accountTier] ?? account.accountTier}` : ""}
          {account.region ? ` · ${regionLabels[account.region] ?? account.region}` : ""}
        </p>
      </div>

      {/* Tab navigation */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab
            account={account}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
          />
        )}
        {activeTab === "engagements" && (
          <EngagementsTab
            engagements={account.engagements}
            onEngagementUpdated={handleEngagementUpdated}
          />
        )}
        {activeTab === "winloss" && (
          <WinLossTab analytics={analytics} analyticsLoading={analyticsLoading} />
        )}
        {activeTab === "financial" && (
          <FinancialTab analytics={analytics} analyticsLoading={analyticsLoading} />
        )}
        {activeTab === "details" && (
          <DetailsTab account={account} onPatch={patchAccount} />
        )}
      </div>
    </div>
  );
}
