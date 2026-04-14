"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, X, ChevronLeft, Loader2, CheckCircle, SkipForward,
  Pause, Play, RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileInfo {
  name: string;
  fullPath: string;
  type: string;
  sizeBytes: number;
  isPrimary: boolean;
  isSubmission?: boolean;
}

interface ProcessedFileRecord {
  name: string;
  fullPath: string;
  type: string;
  isSubmission: boolean;
  extractedText: boolean;
  artefactCreated: boolean;
  inferredBudget?: number | null;
  inferredTimeline?: string | null;
  inferredFinalCost?: number | null;
  classifiedType?: string;
  classificationConfidence?: number;
  classificationReasoning?: string;
  deliverableMetadata?: Record<string, unknown> | null;
  isTemplate?: boolean;
}

interface ImportItem {
  id: string;
  folderName: string;
  files: FileInfo[];
  primaryFileName: string | null;
  inferredClient: string | null;
  inferredIndustry: string | null;
  inferredTechStack: string | null;
  inferredEngagementType: string | null;
  inferredProjectName: string | null;
  inferredDealValue: number | null;
  inferredFinancialValue: number | null;
  confidence: Record<string, number> | null;
  extractedTextPreview: string | null;
  processedFiles: ProcessedFileRecord[] | null;
  matchedAccountId: string | null;
  status: string;
  engagementId: string | null;
  errorMessage: string | null;
}

interface ImportJob {
  id: string;
  sourcePath: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  confirmedFiles: number;
  skippedFiles: number;
  items: ImportItem[];
}

interface Account {
  id: string;
  canonicalName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TECH_STACKS = ["DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT"];
const ENGAGEMENT_TYPES = ["NEW_BUILD", "MIGRATION", "REDESIGN", "ENHANCEMENT", "DISCOVERY"];
const INDUSTRIES = [
  "HEALTHCARE", "FINTECH", "EDUCATION", "GOVERNMENT", "MEDIA", "ECOMMERCE",
  "NONPROFIT", "MANUFACTURING", "PROFESSIONAL_SERVICES", "TECHNOLOGY",
  "ENERGY", "LEGAL", "OTHER",
];

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SKIPPED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const jobStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  PAUSED: "bg-orange-100 text-orange-800",
  REVIEW: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function confidenceBadge(score: number | undefined) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : pct >= 50
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${color} ml-1`}>
      {pct}%
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Edit Dialog
// ---------------------------------------------------------------------------

interface EditDialogProps {
  item: ImportItem;
  accounts: Account[];
  open?: boolean;
  onClose: () => void;
  onConfirm: (itemId: string, overrides: Record<string, unknown>) => Promise<void>;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  TOR: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ESTIMATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PROPOSAL: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  FINANCIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  ADDENDUM: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  QUESTIONS: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  QA_RESPONSE: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  RESEARCH: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  ANNEXURE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  PREREQUISITES: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  RESPONSE_FORMAT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const FILE_TYPE_ORDER = ["TOR", "ANNEXURE", "PREREQUISITES", "RESPONSE_FORMAT", "QUESTIONS", "ADDENDUM", "QA_RESPONSE", "ESTIMATE", "PROPOSAL", "FINANCIAL", "RESEARCH", "OTHER"];

function groupFilesByType(files: FileInfo[]): Record<string, FileInfo[]> {
  const groups: Record<string, FileInfo[]> = {};
  for (const f of files) {
    const key = f.type || "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  return groups;
}

const LIFECYCLE_STAGES = [
  { label: "Phase 0 — Research", types: ["RESEARCH"] },
  { label: "Phase 1 — TOR & Requirements", types: ["TOR", "QUESTIONS", "ANNEXURE", "PREREQUISITES", "RESPONSE_FORMAT"] },
  { label: "Phase 2 — Clarifications & Addendums", types: ["ADDENDUM", "QA_RESPONSE"] },
  { label: "Phase 1A/3 — Estimates & Financials", types: ["ESTIMATE", "FINANCIAL"] },
  { label: "Phase 5 — Proposals", types: ["PROPOSAL"] },
  { label: "Other", types: ["OTHER"] },
];

function getDestinationLabel(fileType: string): string {
  switch (fileType) {
    case "TOR": return "→ Phase 1 TOR_ASSESSMENT";
    case "ANNEXURE": return "→ Phase 1 TOR_ASSESSMENT";
    case "PREREQUISITES": return "→ Phase 1 TOR_ASSESSMENT";
    case "RESPONSE_FORMAT": return "→ Phase 1 TOR_ASSESSMENT";
    case "ESTIMATE": return "→ Phase 1A/3 ESTIMATE";
    case "PROPOSAL": return "→ Phase 5 PROPOSAL";
    case "FINANCIAL": return "→ Phase 5 PROPOSAL";
    case "ADDENDUM": return "→ Phase 2 RESPONSE_ANALYSIS";
    case "QUESTIONS": return "→ Phase 1 QUESTIONS";
    case "QA_RESPONSE": return "→ Phase 2 RESPONSE_ANALYSIS";
    case "RESEARCH": return "→ Phase 0 RESEARCH";
    default: return "→ Skipped";
  }
}

function EstimatePreview({ meta }: { meta: Record<string, unknown> }) {
  const hoursByTab = meta.hoursByTab as Record<string, { low?: number; high?: number }> | undefined;
  const totalHours = meta.totalHours as { low?: number; high?: number } | undefined;
  return (
    <>
      {hoursByTab?.backend && <div>Backend: {hoursByTab.backend.low}-{hoursByTab.backend.high} hrs</div>}
      {hoursByTab?.frontend && <div>Frontend: {hoursByTab.frontend.low}-{hoursByTab.frontend.high} hrs</div>}
      {hoursByTab?.fixedCost && <div>Fixed Cost: {hoursByTab.fixedCost.low}-{hoursByTab.fixedCost.high} hrs</div>}
      {hoursByTab?.design && <div>Design: {hoursByTab.design.low}-{hoursByTab.design.high} hrs</div>}
      {hoursByTab?.ai && <div>AI: {hoursByTab.ai.low}-{hoursByTab.ai.high} hrs</div>}
      <div className="font-medium">Total: {totalHours?.low ?? "?"}-{totalHours?.high ?? "?"} hrs ({(meta.lineItemCount as number) ?? 0} items)</div>
    </>
  );
}

function EditDialog({ item, accounts, open, onClose, onConfirm }: EditDialogProps) {
  const { id: importJobId } = useParams<{ id: string }>();
  const [clientName, setClientName] = React.useState(item.inferredClient ?? "");
  const [projectName, setProjectName] = React.useState(item.inferredProjectName ?? "");
  const [techStack, setTechStack] = React.useState(item.inferredTechStack ?? "DRUPAL");
  const [engagementType, setEngagementType] = React.useState(item.inferredEngagementType ?? "NEW_BUILD");
  const [accountId, setAccountId] = React.useState(item.matchedAccountId ?? "");
  const [budget, setBudget] = React.useState("");
  const [timeline, setTimeline] = React.useState("");
  const [finalCost, setFinalCost] = React.useState(
    item.inferredFinancialValue != null ? String(item.inferredFinancialValue) : ""
  );
  const [saving, setSaving] = React.useState(false);
  const [localProcessedFiles, setLocalProcessedFiles] = React.useState(item.processedFiles ?? []);
  const [localFiles, setLocalFiles] = React.useState(item.files ?? []);
  const [reclassifying, setReclassifying] = React.useState<string | null>(null);

  async function handleReclassify(fullPath: string, newType: string) {
    setReclassifying(fullPath);
    try {
      const res = await fetch(`/api/imports/${importJobId}/items/${item.id}/reclassify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullPath, newType }),
      });
      if (res.ok) {
        // Update local state to reflect the change immediately
        setLocalProcessedFiles((prev) =>
          prev.map((pf) =>
            pf.fullPath === fullPath
              ? { ...pf, classifiedType: newType, classificationConfidence: 1.0, classificationReasoning: `Manual override`, type: newType }
              : pf
          )
        );
        setLocalFiles((prev) =>
          prev.map((f) =>
            f.fullPath === fullPath ? { ...f, type: newType } : f
          )
        );
      }
    } finally {
      setReclassifying(null);
    }
  }

  // Initialise budget/timeline from processedFiles inference
  React.useEffect(() => {
    if (!item.processedFiles) return;
    for (const pf of item.processedFiles) {
      if (pf.inferredBudget != null && !budget) setBudget(String(pf.inferredBudget));
      if (pf.inferredTimeline != null && !timeline) setTimeline(pf.inferredTimeline);
      if (pf.inferredFinalCost != null && !finalCost) setFinalCost(String(pf.inferredFinalCost));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(item.id, {
        clientName,
        projectName,
        techStack,
        engagementType,
        accountId: accountId || undefined,
        estimatedBudget: budget ? parseFloat(budget) : undefined,
        deliveryTimeline: timeline || undefined,
        finalCostSubmitted: finalCost ? parseFloat(finalCost) : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const fileGroups = groupFilesByType(localFiles as FileInfo[]);
  const processedMap = new Map(
    localProcessedFiles.map((pf) => [pf.fullPath, pf])
  );

  // Workstream C: Compute superseded paths (standard files that have submission counterparts)
  const supersededPaths = React.useMemo(() => {
    const paths = new Set<string>();
    const byType = new Map<string, { submission: FileInfo[]; standard: FileInfo[] }>();
    for (const f of localFiles) {
      const pfr = processedMap.get(f.fullPath);
      const effectiveType = pfr?.classifiedType ?? f.type;
      if (!byType.has(effectiveType)) byType.set(effectiveType, { submission: [], standard: [] });
      const group = byType.get(effectiveType)!;
      if (f.isSubmission) {
        group.submission.push(f);
      } else {
        group.standard.push(f);
      }
    }
    for (const [, group] of byType) {
      if (group.submission.length > 0 && group.standard.length > 0) {
        for (const std of group.standard) {
          paths.add(std.fullPath);
        }
      }
    }
    return paths;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFiles, localProcessedFiles]);

  // Compute file count summary for each type
  const typeCounts = FILE_TYPE_ORDER.filter((t) => fileGroups[t]).map((t) => ({
    type: t,
    count: fileGroups[t].length,
  }));

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="size-4 mr-1" /> Back to list
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Review: {item.folderName}</h2>
            {typeCounts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {typeCounts.map((tc) => `${tc.count} ${tc.type}`).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleConfirm}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
            Confirm Import
          </Button>
        </div>
      </div>

      {/* Two-column layout: metadata on left, files on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Metadata fields */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Engagement Metadata</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Client Name</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Project Name</label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tech Stack</label>
              <Select value={techStack} onValueChange={(v) => { if (v) setTechStack(v); }}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TECH_STACKS.map((ts) => (
                    <SelectItem key={ts} value={ts}>{ts.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={engagementType} onValueChange={(v) => { if (v) setEngagementType(v); }}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>{et.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Account</label>
            <Select value={accountId} onValueChange={(v) => { setAccountId(v ?? ""); }}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Select or create new..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Create new from client name</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.canonicalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget / Timeline / Final Cost */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-muted-foreground">Budget (USD)</label>
                {!budget && !localProcessedFiles.some(
                  (pf) => (pf.classifiedType === "TOR" || pf.classifiedType === "ADDENDUM") &&
                    (pf.deliverableMetadata as Record<string, unknown> | null)?.estimatedBudget != null
                ) && (
                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="No budget found in TOR or Addendum documents">
                    Not in docs
                  </span>
                )}
              </div>
              <Input
                type="number"
                placeholder="e.g. 250000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Timeline</label>
              <Input
                placeholder="e.g. 6 months"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Final Cost (USD)</label>
              <Input
                type="number"
                placeholder="e.g. 180000"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Text preview */}
          {item.extractedTextPreview && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Extracted text preview</label>
              <div className="rounded border bg-muted/50 p-3 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
                {item.extractedTextPreview}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Files grouped by lifecycle stage */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Files in folder</h3>

          {localFiles.length > 0 && (() => {
            const allSubmissionFiles = localFiles.filter((f) => f.isSubmission);
            const allNonSubmissionFiles = localFiles.filter((f) => !f.isSubmission);
            const nonSubGroups = groupFilesByType(allNonSubmissionFiles);

            // Shared file row renderer
            function renderFileRow(f: FileInfo, i: number, options?: { showSubmissionBadge?: boolean }) {
              const pfRecord = processedMap.get(f.fullPath);
              const aiType = pfRecord?.classifiedType;
              const aiConf = pfRecord?.classificationConfidence;
              const aiReasoning = pfRecord?.classificationReasoning;
              const hasAiClass = aiType != null && aiConf != null && aiConf > 0;
              const lowConfidence = hasAiClass && aiConf! < 0.6;
              const confPct = aiConf != null ? Math.round(aiConf * 100) : null;
              const displayType = aiType ?? f.type;
              const isSuperseded = supersededPaths.has(f.fullPath);
              const isFileTemplate = pfRecord?.isTemplate === true;
              return (
                <div key={i} className={`space-y-0.5 ${isSuperseded ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className={f.isPrimary ? "font-medium truncate" : "text-muted-foreground truncate"}>
                      {f.isPrimary && <Badge variant="outline" className="mr-1 text-[10px] py-0">Primary</Badge>}
                      {options?.showSubmissionBadge && (
                        <Badge variant="outline" className="mr-1 text-[10px] py-0 border-amber-300 text-amber-700 dark:text-amber-400">Submission</Badge>
                      )}
                      {f.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Reclassify dropdown */}
                      <Select
                        value={displayType}
                        onValueChange={(v) => { if (v && v !== displayType) handleReclassify(f.fullPath, v); }}
                        disabled={reclassifying === f.fullPath}
                      >
                        <SelectTrigger
                          className={`h-5 px-1.5 py-0 text-[10px] font-medium border-0 w-auto min-w-0 ${FILE_TYPE_COLORS[displayType] ?? FILE_TYPE_COLORS.OTHER}`}
                          title={aiReasoning ?? undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FILE_TYPE_ORDER.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isFileTemplate && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Template?
                        </span>
                      )}
                      {isSuperseded && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          superseded
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{getDestinationLabel(displayType)}</span>
                      {confPct != null && (
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            confPct >= 80
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : confPct >= 60
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                          title={aiReasoning ?? undefined}
                        >
                          {confPct}%
                        </span>
                      )}
                      {pfRecord && (
                        <span className={`text-[10px] ${pfRecord.extractedText ? "text-green-600" : "text-red-500"}`}>
                          {pfRecord.extractedText ? "extracted" : "failed"}
                        </span>
                      )}
                      <span className="text-muted-foreground text-[10px]">{formatBytes(f.sizeBytes)}</span>
                    </div>
                  </div>
                  {lowConfidence && !isFileTemplate && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-2">
                      Low confidence — please verify classification
                    </p>
                  )}
                  {pfRecord?.deliverableMetadata && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 pl-2 border-l-2 space-y-0.5">
                      {pfRecord.classifiedType === "TOR" && (
                        <div>{`${(pfRecord.deliverableMetadata as Record<string, unknown>).requirementCount ?? 0} requirements, ${(pfRecord.deliverableMetadata as Record<string, unknown>).integrationCount ?? 0} integrations`}</div>
                      )}
                      {pfRecord.classifiedType === "ESTIMATE" && (
                        <EstimatePreview meta={pfRecord.deliverableMetadata as Record<string, unknown>} />
                      )}
                      {pfRecord.classifiedType === "PROPOSAL" && (
                        <div>{`${((pfRecord.deliverableMetadata as Record<string, unknown>).sections as unknown[] | undefined)?.length ?? 0} sections`}</div>
                      )}
                      {pfRecord.classifiedType === "FINANCIAL" && (
                        <div>{`Total: $${((pfRecord.deliverableMetadata as Record<string, unknown>).totalCost as number | undefined)?.toLocaleString() ?? "N/A"}`}</div>
                      )}
                      {pfRecord.classifiedType === "QA_RESPONSE" && (
                        <div>{`${(pfRecord.deliverableMetadata as Record<string, unknown>).questionCount ?? 0} questions, ${(pfRecord.deliverableMetadata as Record<string, unknown>).answeredCount ?? 0} answered`}</div>
                      )}
                      {pfRecord.classifiedType === "ANNEXURE" && (
                        <div>{`${((pfRecord.deliverableMetadata as Record<string, unknown>).keySpecifications as unknown[] | undefined)?.length ?? 0} specifications, type: ${(pfRecord.deliverableMetadata as Record<string, unknown>).type ?? "N/A"}`}</div>
                      )}
                      {pfRecord.classifiedType === "PREREQUISITES" && (
                        <div>{`${((pfRecord.deliverableMetadata as Record<string, unknown>).eligibilityCriteria as unknown[] | undefined)?.length ?? 0} criteria, ${((pfRecord.deliverableMetadata as Record<string, unknown>).mandatoryCertifications as unknown[] | undefined)?.length ?? 0} certifications`}</div>
                      )}
                      {pfRecord.classifiedType === "RESPONSE_FORMAT" && (
                        <div>{`${((pfRecord.deliverableMetadata as Record<string, unknown>).requiredSections as unknown[] | undefined)?.length ?? 0} sections, ${((pfRecord.deliverableMetadata as Record<string, unknown>).scoringCriteria as unknown[] | undefined)?.length ?? 0} scoring criteria`}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {/* Consolidated Final Submission section at the top */}
                {allSubmissionFiles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                      Final Submission ({allSubmissionFiles.length} files)
                    </p>
                    <div className="rounded border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-2 space-y-1 max-h-48 overflow-y-auto">
                      {allSubmissionFiles.map((f, i) => renderFileRow(f, i, { showSubmissionBadge: false }))}
                    </div>
                  </div>
                )}

                {/* Non-submission files grouped by lifecycle stage */}
                {LIFECYCLE_STAGES.map((stage) => {
                  const stageFiles = stage.types.flatMap((t) => nonSubGroups[t] ?? []);
                  if (stageFiles.length === 0) return null;
                  return (
                    <div key={stage.label} className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{stage.label}</p>
                      <div className="rounded border p-2 space-y-1 max-h-48 overflow-y-auto">
                        {stageFiles.map((f, i) => renderFileRow(f, i))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch Outcome Panel
// ---------------------------------------------------------------------------

const OUTCOMES = ["WON", "LOST", "NO_DECISION", "WITHDRAWN", "PARTIAL_WIN", "DEFERRED", "NOT_SUBMITTED"] as const;
const LOSS_REASONS = ["PRICE_TOO_HIGH", "SCOPE_MISMATCH", "COMPETITOR_PREFERRED", "TIMELINE_MISMATCH", "BUDGET_CUT", "RELATIONSHIP", "TECHNICAL_FIT", "NO_DECISION_MADE", "OTHER"] as const;

function BatchOutcomePanel({ importJobId, items, onSaved }: {
  importJobId: string;
  items: ImportItem[];
  onSaved: () => void;
}) {
  const [outcomes, setOutcomes] = React.useState<Record<string, {
    outcome: string;
    lossReason: string;
    actualContractValue: string;
    competitorWhoWon: string;
  }>>(() => {
    const initial: Record<string, { outcome: string; lossReason: string; actualContractValue: string; competitorWhoWon: string }> = {};
    for (const item of items) {
      if (item.engagementId) {
        initial[item.engagementId] = { outcome: "", lossReason: "", actualContractValue: "", competitorWhoWon: "" };
      }
    }
    return initial;
  });
  const [saving, setSaving] = React.useState(false);
  const [applyAllOutcome, setApplyAllOutcome] = React.useState("");

  function updateOutcome(engId: string, field: string, value: string) {
    setOutcomes((prev) => ({
      ...prev,
      [engId]: { ...prev[engId], [field]: value },
    }));
  }

  function applyToAll() {
    if (!applyAllOutcome) return;
    setOutcomes((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], outcome: applyAllOutcome };
      }
      return next;
    });
  }

  async function handleSave() {
    const payload = Object.entries(outcomes)
      .filter(([, v]) => v.outcome)
      .map(([engagementId, v]) => ({
        engagementId,
        outcome: v.outcome,
        lossReason: v.outcome === "LOST" && v.lossReason ? v.lossReason : null,
        actualContractValue: v.outcome === "WON" && v.actualContractValue ? parseFloat(v.actualContractValue) : null,
        competitorWhoWon: v.outcome === "LOST" && v.competitorWhoWon ? v.competitorWhoWon : null,
      }));

    if (payload.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/imports/${importJobId}/batch-outcomes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomes: payload }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tag Outcomes</h3>
        <div className="flex items-center gap-2">
          <Select value={applyAllOutcome} onValueChange={(v) => setApplyAllOutcome(v ?? "")}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Apply to all..." /></SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => <SelectItem key={o} value={o} className="text-xs">{o.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyToAll}>Apply</Button>
          <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
            Save All
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Engagement</TableHead>
            <TableHead className="text-xs">Outcome</TableHead>
            <TableHead className="text-xs">Loss Reason</TableHead>
            <TableHead className="text-xs">Contract Value</TableHead>
            <TableHead className="text-xs">Competitor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            if (!item.engagementId) return null;
            const o = outcomes[item.engagementId];
            if (!o) return null;
            return (
              <TableRow key={item.engagementId}>
                <TableCell className="text-xs font-medium">{item.inferredClient ?? item.folderName}</TableCell>
                <TableCell>
                  <Select value={o.outcome} onValueChange={(v) => { if (v) updateOutcome(item.engagementId!, "outcome", v); }}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map((oc) => <SelectItem key={oc} value={oc} className="text-xs">{oc.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {o.outcome === "LOST" && (
                    <Select value={o.lossReason} onValueChange={(v) => { if (v) updateOutcome(item.engagementId!, "lossReason", v); }}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Reason..." /></SelectTrigger>
                      <SelectContent>
                        {LOSS_REASONS.map((lr) => <SelectItem key={lr} value={lr} className="text-xs">{lr.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {o.outcome === "WON" && (
                    <Input
                      type="number"
                      placeholder="USD"
                      value={o.actualContractValue}
                      onChange={(e) => updateOutcome(item.engagementId!, "actualContractValue", e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {o.outcome === "LOST" && (
                    <Input
                      placeholder="Competitor"
                      value={o.competitorWhoWon}
                      onChange={(e) => updateOutcome(item.engagementId!, "competitorWhoWon", e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = React.useState<ImportJob | null>(null);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editItem, setEditItem] = React.useState<ImportItem | null>(null);
  const [bulkConfirming, setBulkConfirming] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [pauseResumeLoading, setPauseResumeLoading] = React.useState(false);

  React.useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // SSE progress subscription while job is PENDING or PROCESSING
  React.useEffect(() => {
    if (!job) return;
    if (job.status !== "PROCESSING" && job.status !== "PENDING") return;

    const eventSource = new EventSource(`/api/imports/${id}/progress`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        processedFiles?: number;
        totalFiles?: number;
        status?: string;
      };
      if (data.type === "progress") {
        setJob((prev) =>
          prev ? { ...prev, ...data } : prev
        );
      }
      if (data.type === "complete") {
        eventSource.close();
        fetchData();
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job?.status]);

  async function fetchData() {
    setLoading(true);
    try {
      const [jobRes, accRes] = await Promise.all([
        fetch(`/api/imports/${id}`),
        fetch("/api/accounts"),
      ]);
      if (jobRes.ok) setJob(await jobRes.json() as ImportJob);
      if (accRes.ok) setAccounts(await accRes.json() as Account[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(itemId: string, overrides: Record<string, unknown>) {
    const res = await fetch(`/api/imports/${id}/items/${itemId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    });
    if (res.ok) {
      await fetchData();
    }
  }

  async function handleSkip(itemId: string) {
    const res = await fetch(`/api/imports/${id}/items/${itemId}/skip`, {
      method: "POST",
    });
    if (res.ok) {
      await fetchData();
    }
  }

  async function handleRetry(itemId: string) {
    const res = await fetch(`/api/imports/${id}/items/${itemId}/retry`, {
      method: "POST",
    });
    if (res.ok) {
      await fetchData();
    }
  }

  async function handleBulkConfirm() {
    if (!job || selectedIds.size === 0) return;
    setBulkConfirming(true);
    try {
      const res = await fetch(`/api/imports/${id}/bulk-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        await fetchData();
      }
    } finally {
      setBulkConfirming(false);
    }
  }

  async function handlePause() {
    setPauseResumeLoading(true);
    try {
      const res = await fetch(`/api/imports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      });
      if (res.ok) {
        setJob((prev) => prev ? { ...prev, status: "PAUSED" } : prev);
      }
    } finally {
      setPauseResumeLoading(false);
    }
  }

  async function handleResume() {
    setPauseResumeLoading(true);
    try {
      const res = await fetch(`/api/imports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PROCESSING" }),
      });
      if (res.ok) {
        setJob((prev) => prev ? { ...prev, status: "PROCESSING" } : prev);
      }
    } finally {
      setPauseResumeLoading(false);
    }
  }

  // Selection helpers
  const pendingItems = job?.items.filter((i) => i.status === "PENDING_REVIEW") ?? [];
  const highConfidenceItems = pendingItems.filter(
    (i) => i.inferredClient && i.confidence && (i.confidence.clientName ?? 0) >= 0.7
  );

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(pendingItems.map((i) => i.id)));
  }

  function selectAllHighConfidence() {
    setSelectedIds(new Set(highConfidenceItems.map((i) => i.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const allPendingSelected =
    pendingItems.length > 0 && pendingItems.every((i) => selectedIds.has(i.id));

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading import details...</p>;
  }

  if (!job) {
    return <p className="text-sm text-destructive">Import job not found.</p>;
  }

  const pendingCount = pendingItems.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/imports")}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{job.sourcePath}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${jobStatusColors[job.status] ?? ""}`}
            >
              {job.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {job.processedFiles}/{job.totalFiles} processed
            {" | "}
            {job.confirmedFiles} confirmed
            {" | "}
            {job.skippedFiles} skipped
            {pendingCount > 0 && ` | ${pendingCount} pending review`}
          </p>
        </div>

        {/* Pause/Resume buttons */}
        {job.status === "PROCESSING" && (
          <Button
            variant="outline"
            size="sm"
            disabled={pauseResumeLoading}
            onClick={handlePause}
          >
            {pauseResumeLoading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Pause className="size-3.5 mr-1.5" />
            )}
            Pause
          </Button>
        )}
        {job.status === "PAUSED" && (
          <Button
            size="sm"
            disabled={pauseResumeLoading}
            onClick={handleResume}
          >
            {pauseResumeLoading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Play className="size-3.5 mr-1.5" />
            )}
            Resume
          </Button>
        )}

        {/* Bulk confirm selected */}
        {selectedIds.size > 0 && (
          <Button size="sm" disabled={bulkConfirming} onClick={handleBulkConfirm}>
            {bulkConfirming ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCircle className="size-3.5 mr-1.5" />
            )}
            Confirm Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Selection toolbar */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            className="underline hover:text-foreground"
            onClick={allPendingSelected ? clearSelection : selectAll}
          >
            {allPendingSelected ? "Deselect all" : `Select all ${pendingCount} pending`}
          </button>
          {highConfidenceItems.length > 0 && (
            <>
              <span>·</span>
              <button
                className="underline hover:text-foreground"
                onClick={selectAllHighConfidence}
              >
                Select all high-confidence ({highConfidenceItems.length})
              </button>
            </>
          )}
          {selectedIds.size > 0 && (
            <>
              <span>·</span>
              <button className="underline hover:text-foreground" onClick={clearSelection}>
                Clear selection
              </button>
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {selectedIds.size} selected
              </Badge>
            </>
          )}
        </div>
      )}

      {/* Processing progress */}
      {(job.status === "PENDING" || job.status === "PROCESSING") && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="size-4 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Processing ZIP file...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {job.processedFiles} of {job.totalFiles} folders processed
          </p>
        </div>
      )}

      {/* Paused notice */}
      {job.status === "PAUSED" && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/10 p-4">
          <div className="flex items-center gap-2">
            <Pause className="size-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Import paused — {job.processedFiles}/{job.totalFiles} folders processed. Click Resume to continue.
            </span>
          </div>
        </div>
      )}

      {/* Inline review panel OR items table */}
      {editItem ? (
        <EditDialog
          item={editItem}
          accounts={accounts}
          open={true}
          onClose={() => setEditItem(null)}
          onConfirm={handleConfirm}
        />
      ) : job.items.length > 0 && (
        <div className="rounded-md border">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  {pendingCount > 0 && (
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={allPendingSelected}
                      onChange={() => allPendingSelected ? clearSelection() : selectAll()}
                    />
                  )}
                </TableHead>
                <TableHead className="w-[12%]">Folder</TableHead>
                <TableHead className="w-[12%]">Client</TableHead>
                <TableHead className="w-[14%]">Project</TableHead>
                <TableHead className="w-[8%]">Tech Stack</TableHead>
                <TableHead className="w-[8%]">Type</TableHead>
                <TableHead className="w-[22%]">Files</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[8%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="w-8">
                    {item.status === "PENDING_REVIEW" && (
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[160px] truncate">
                    {item.folderName}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.inferredClient ?? <span className="text-muted-foreground">—</span>}
                    {confidenceBadge(item.confidence?.clientName)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[140px] truncate">
                    {item.inferredProjectName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.inferredTechStack?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.inferredEngagementType?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="leading-relaxed break-words">
                    {(() => {
                      const files = item.files as FileInfo[];
                      const counts: Record<string, number> = {};
                      for (const f of files) counts[f.type] = (counts[f.type] ?? 0) + 1;
                      const parts = FILE_TYPE_ORDER.filter((t) => counts[t]).map((t) => `${counts[t]} ${t}`);
                      return parts.length > 0 ? parts.join(", ") : String(files.length);
                    })()}
                    {item.processedFiles && item.processedFiles.some((pf) => pf.isSubmission) && (
                      <span className="ml-1 text-amber-600 text-[10px]">+ submission</span>
                    )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status] ?? ""}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    {item.errorMessage && (
                      <p className="text-[10px] text-destructive mt-0.5 max-w-[140px] truncate" title={item.errorMessage}>
                        {item.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "PENDING_REVIEW" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditItem(item)}
                        >
                          <Check className="size-3 mr-1" />
                          Review
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => handleSkip(item.id)}
                        >
                          <SkipForward className="size-3 mr-1" />
                          Skip
                        </Button>
                      </div>
                    )}
                    {item.status === "CONFIRMED" && item.engagementId && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => router.push(`/engagements/${item.engagementId}`)}
                      >
                        View
                      </Button>
                    )}
                    {item.status === "FAILED" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleRetry(item.id)}
                        >
                          <RotateCcw className="size-3 mr-1" />
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => handleSkip(item.id)}
                        >
                          <SkipForward className="size-3 mr-1" />
                          Skip
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Batch Outcome Tagging — shown when job is COMPLETED */}
      {job.status === "COMPLETED" && (() => {
        const confirmedItems = job.items.filter((i) => i.status === "CONFIRMED" && i.engagementId);
        if (confirmedItems.length === 0) return null;
        return <BatchOutcomePanel importJobId={id} items={confirmedItems} onSaved={fetchData} />;
      })()}
    </div>
  );
}
