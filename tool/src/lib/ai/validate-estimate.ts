/**
 * Post-generation estimate validation.
 * Parses estimate markdown, looks up BenchmarkRef values against the DB,
 * and flags deviations. Also runs structural checks (always-include tasks,
 * assumption sources, risk register coverage, tab organization).
 * Pure TypeScript — no AI calls.
 */

import { prisma } from "@/lib/db";
import { runCoverageValidation } from "./validators/coverage";
import { runConfFormulaValidation } from "./validators/conf-formula";
import { runAssumptionValidation } from "./validators/assumption";
import { runRiskRegisterValidation } from "./validators/risk-register";
import { runIntegrationTierValidation } from "./validators/integration-tier";
import type { ValidatorResult } from "./validators/types";

export interface ValidationItem {
  task: string;
  tab: string;
  hours: number;
  benchmarkRef: string;
  benchmarkLow: number | null;
  benchmarkHigh: number | null;
  deviation: number | null;
  status: "PASS" | "WARN" | "FAIL" | "NO_BENCHMARK";
  reason: string;
}

export interface ValidationReport {
  passCount: number;
  warnCount: number;
  failCount: number;
  noBenchmarkCount: number;
  unmatchedRefs: string[];
  items: ValidationItem[];
}

export interface StructuralValidationItem {
  category:
    | "ALWAYS_INCLUDE"
    | "ASSUMPTION_SOURCE"
    | "RISK_REGISTER"
    | "TAB_ORGANIZATION"
    | "BENCHMARK_COVERAGE";
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  details?: string[];
}

export interface FullValidationReport {
  benchmark: ValidationReport;
  structural: StructuralValidationItem[];
  overallStatus: "PASS" | "WARN" | "FAIL";
  structured?: StructuredValidatorSummary;
}

/**
 * Summary of the DB-driven validators run against the structured
 * `TorRequirement` / `LineItem` / `Assumption` / `RiskRegisterEntry` rows.
 * Only populated when `validateEstimateFull` is called with an engagementId.
 */
export interface StructuredValidatorSummary {
  coverage: ValidatorResult;
  confFormula: ValidatorResult;
  assumption: ValidatorResult;
  riskRegister: ValidatorResult;
  integrationTier: ValidatorResult;
  accuracyScore: number;
  gapCount: number;
  orphanCount: number;
  confFormulaViolations: number;
  validationReportId?: string;
}

interface ParsedLineItem {
  task: string;
  tab: string;
  hours: number;
  conf: number | null;
  benchmarkRef: string;
  hasDeviationNote: boolean;
  assumptions: string;
}

/**
 * Parse estimate markdown and extract line items with BenchmarkRef.
 * Handles both Backend (Task|Description|Hours|BenchmarkRef|Conf|...)
 * and Frontend (same but with Exclusions instead of Proposed Solution).
 */
function parseLineItems(markdown: string): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  const lines = markdown.split("\n");

  const tabPatterns: { tab: string; pattern: RegExp }[] = [
    { tab: "Backend", pattern: /^#{1,2}\s+Backend\b/i },
    { tab: "Frontend", pattern: /^#{1,2}\s+Frontend\b/i },
    { tab: "Fixed Cost", pattern: /^#{1,2}\s+Fixed\s+Cost/i },
    { tab: "AI", pattern: /^#{1,2}\s+AI\b/i },
  ];

  let currentTab = "";
  let colMap: { task: number; hours: number; benchmarkRef: number; assumptions: number; conf: number } | null = null;
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect tab section
    for (const { tab, pattern } of tabPatterns) {
      if (pattern.test(trimmed)) {
        currentTab = tab;
        inTable = false;
        colMap = null;
        break;
      }
    }

    // Stop at Risk/Assumption register
    if (/^##?\s+(Risk\s+Register|Assumption\s+Register)/i.test(trimmed)) {
      currentTab = "";
      continue;
    }

    if (!currentTab) continue;

    // Detect table header
    if (
      trimmed.startsWith("|") &&
      (trimmed.toLowerCase().includes("benchmarkref") || trimmed.toLowerCase().includes("hours")) &&
      !inTable
    ) {
      const headers = trimmed
        .split("|")
        .slice(1, -1)
        .map((h) => h.trim().toLowerCase());

      const taskIdx = headers.findIndex((h) => h === "task");
      const hoursIdx = headers.findIndex((h) => h === "hours");
      const bmIdx = headers.findIndex((h) => h.includes("benchmarkref"));
      const assIdx = headers.findIndex((h) => h.includes("assumption"));
      const confIdx = headers.findIndex((h) => h === "conf");

      if (hoursIdx >= 0) {
        colMap = {
          task: taskIdx >= 0 ? taskIdx : 0,
          hours: hoursIdx,
          benchmarkRef: bmIdx >= 0 ? bmIdx : -1,
          assumptions: assIdx >= 0 ? assIdx : -1,
          conf: confIdx >= 0 ? confIdx : -1,
        };
      }
      continue;
    }

    // Skip separator
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      if (colMap) inTable = true;
      continue;
    }

    // Parse data rows
    if (inTable && colMap && trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      const task = cells[colMap.task] ?? "";
      const hours = parseFloat(cells[colMap.hours] ?? "");
      const benchmarkRef = colMap.benchmarkRef >= 0 ? (cells[colMap.benchmarkRef] ?? "").trim() : "";
      const assumptions = colMap.assumptions >= 0 ? (cells[colMap.assumptions] ?? "") : "";
      const confStr = colMap.conf >= 0 ? (cells[colMap.conf] ?? "") : "";
      const conf = confStr ? parseInt(confStr, 10) : null;

      if (task && !isNaN(hours) && hours > 0) {
        items.push({
          task,
          tab: currentTab,
          hours,
          conf: isNaN(conf ?? NaN) ? null : conf,
          benchmarkRef: benchmarkRef || "N/A",
          hasDeviationNote: assumptions.toUpperCase().includes("BENCHMARK DEVIATION"),
          assumptions,
        });
      }
    }

    // Reset table on new subsection
    if (/^#{2,3}\s/.test(trimmed) && !trimmed.toLowerCase().includes("tab")) {
      inTable = false;
      colMap = null;
    }
  }

  return items;
}

/**
 * Build a lookup map from BenchmarkKey → { lowHours, highHours }.
 * Keys are generated the same way as in agent.ts loadBenchmarks().
 */
async function loadBenchmarkLookup(): Promise<
  Map<string, { lowHours: number; highHours: number }>
> {
  const lookup = new Map<string, { lowHours: number; highHours: number }>();

  try {
    const benchmarks = await prisma.benchmark.findMany({
      where: { isActive: true },
      select: { category: true, taskType: true, lowHours: true, highHours: true },
    });

    const toSlug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    for (const b of benchmarks) {
      const key = `${toSlug(b.category)}/${toSlug(b.taskType)}`;
      lookup.set(key, { lowHours: b.lowHours, highHours: b.highHours });
    }
  } catch {
    // DB unavailable — return empty lookup
  }

  return lookup;
}

/**
 * Validate an estimate markdown against benchmark data.
 * Returns a report with pass/warn/fail per line item.
 */
export async function validateEstimate(
  contentMd: string
): Promise<ValidationReport> {
  const lineItems = parseLineItems(contentMd);
  const benchmarkLookup = await loadBenchmarkLookup();

  const report: ValidationReport = {
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    noBenchmarkCount: 0,
    unmatchedRefs: [],
    items: [],
  };

  for (const item of lineItems) {
    const ref = item.benchmarkRef.toLowerCase().trim();

    if (ref === "n/a" || ref === "" || ref === "-") {
      report.noBenchmarkCount++;
      report.unmatchedRefs.push(item.task);
      report.items.push({
        task: item.task,
        tab: item.tab,
        hours: item.hours,
        benchmarkRef: item.benchmarkRef,
        benchmarkLow: null,
        benchmarkHigh: null,
        deviation: null,
        status: "NO_BENCHMARK",
        reason: "No matching benchmark specified",
      });
      continue;
    }

    const benchmark = benchmarkLookup.get(ref);

    if (!benchmark) {
      report.noBenchmarkCount++;
      report.unmatchedRefs.push(`${item.benchmarkRef} (${item.task})`);
      report.items.push({
        task: item.task,
        tab: item.tab,
        hours: item.hours,
        benchmarkRef: item.benchmarkRef,
        benchmarkLow: null,
        benchmarkHigh: null,
        deviation: null,
        status: "NO_BENCHMARK",
        reason: `BenchmarkRef "${item.benchmarkRef}" not found in database`,
      });
      continue;
    }

    const mid = (benchmark.lowHours + benchmark.highHours) / 2;
    const deviation = mid > 0 ? ((item.hours - mid) / mid) * 100 : 0;
    const absDeviation = Math.abs(deviation);

    let status: ValidationItem["status"];
    let reason: string;

    if (item.hours >= benchmark.lowHours && item.hours <= benchmark.highHours) {
      status = "PASS";
      reason = "Within benchmark range";
      report.passCount++;
    } else if (absDeviation <= 25) {
      status = "WARN";
      reason = `${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% from mid-point (${mid}h)`;
      report.warnCount++;
    } else {
      // >25% deviation — FAIL unless justified
      if (item.hasDeviationNote) {
        status = "WARN";
        reason = `${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% deviation with justification`;
        report.warnCount++;
      } else {
        status = "FAIL";
        reason = `${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% deviation without justification`;
        report.failCount++;
      }
    }

    report.items.push({
      task: item.task,
      tab: item.tab,
      hours: item.hours,
      benchmarkRef: item.benchmarkRef,
      benchmarkLow: benchmark.lowHours,
      benchmarkHigh: benchmark.highHours,
      deviation: Math.round(deviation * 10) / 10,
      status,
      reason,
    });
  }

  return report;
}

// ─── Structural Validators ──────────────────────────────────────────────────

/** Required Backend tasks by tech stack (fuzzy keyword sets — match ALL keywords in a set) */
const ALWAYS_INCLUDE_TASKS: Record<string, string[][]> = {
  DRUPAL: [
    ["discovery", "requirement"],
    ["environment", "setup"],
    ["install", "config"],
    ["configuration", "management"],
    ["roles", "permission"],
    ["media", "library"],
    ["deployment", "pipeline"],
    ["qa", "stabil"],
  ],
  DRUPAL_NEXTJS: [
    ["discovery", "requirement"],
    ["environment", "setup"],
    ["install", "config"],
    ["configuration", "management"],
    ["roles", "permission"],
    ["media", "library"],
    ["deployment", "pipeline"],
    ["qa", "stabil"],
  ],
  WORDPRESS: [
    ["discovery", "requirement"],
    ["environment", "setup"],
    ["wordpress", "install"],
    ["plugin", "config"],
    ["roles", "permission"],
    ["media", "library"],
    ["deployment", "pipeline"],
    ["qa", "stabil"],
  ],
  WORDPRESS_NEXTJS: [
    ["discovery", "requirement"],
    ["environment", "setup"],
    ["wordpress", "install"],
    ["plugin", "config"],
    ["roles", "permission"],
    ["media", "library"],
    ["deployment", "pipeline"],
    ["qa", "stabil"],
  ],
};

/** Human-readable labels for always-include tasks */
const ALWAYS_INCLUDE_LABELS: Record<string, string[]> = {
  DRUPAL: [
    "Discovery & Requirements Analysis",
    "Environment Setup",
    "Drupal Installation & Base Configuration",
    "Configuration Management Setup",
    "Roles & Permissions",
    "Media Library Setup",
    "Deployment Pipeline",
    "QA/Bug Fixes & Stabilisation",
  ],
  DRUPAL_NEXTJS: [
    "Discovery & Requirements Analysis",
    "Environment Setup",
    "Drupal Installation & Base Configuration",
    "Configuration Management Setup",
    "Roles & Permissions",
    "Media Library Setup",
    "Deployment Pipeline",
    "QA/Bug Fixes & Stabilisation",
  ],
  WORDPRESS: [
    "Discovery & Requirements Analysis",
    "Environment Setup",
    "WordPress Installation & Configuration",
    "Plugin Configuration & Setup",
    "Roles & Permissions",
    "Media Library Setup",
    "Deployment Pipeline",
    "QA/Bug Fixes & Stabilisation",
  ],
  WORDPRESS_NEXTJS: [
    "Discovery & Requirements Analysis",
    "Environment Setup",
    "WordPress Installation & Configuration",
    "Plugin Configuration & Setup",
    "Roles & Permissions",
    "Media Library Setup",
    "Deployment Pipeline",
    "QA/Bug Fixes & Stabilisation",
  ],
};

/**
 * Check that all required Backend tasks are present (CARL RULE 16).
 * Uses fuzzy keyword matching — a task passes if its name contains ALL keywords in a set.
 */
function validateAlwaysIncludeTasks(
  lineItems: ParsedLineItem[],
  techStack: string
): StructuralValidationItem {
  const keywordSets = ALWAYS_INCLUDE_TASKS[techStack] ?? ALWAYS_INCLUDE_TASKS["DRUPAL"];
  const labels = ALWAYS_INCLUDE_LABELS[techStack] ?? ALWAYS_INCLUDE_LABELS["DRUPAL"];
  const backendItems = lineItems.filter((i) => i.tab === "Backend");
  const missing: string[] = [];

  for (let i = 0; i < keywordSets.length; i++) {
    const keywords = keywordSets[i];
    const found = backendItems.some((item) => {
      const taskLower = item.task.toLowerCase();
      return keywords.every((kw) => taskLower.includes(kw));
    });
    if (!found) {
      missing.push(labels[i]);
    }
  }

  if (missing.length === 0) {
    return {
      category: "ALWAYS_INCLUDE",
      status: "PASS",
      message: "All required Backend tasks present",
    };
  }

  return {
    category: "ALWAYS_INCLUDE",
    status: missing.length >= 3 ? "FAIL" : "WARN",
    message: `${missing.length} required Backend task(s) missing`,
    details: missing,
  };
}

/**
 * Check assumption cells for references to internal artifacts (CARL RULE 10).
 * Flags references to claude-artefacts/, REQ- IDs, assessment requirement, task table entries.
 */
function validateAssumptionSources(lineItems: ParsedLineItem[]): StructuralValidationItem {
  const INTERNAL_PATTERNS = [
    /claude-artefacts\//i,
    /\bREQ-\d+/i,
    /assessment\s+requirement/i,
    /task\s+table\s+(entry|item|row)/i,
    /tor-assessment\.md/i,
    /response-analysis\.md/i,
  ];

  const violations: string[] = [];

  for (const item of lineItems) {
    if (!item.assumptions) continue;
    for (const pattern of INTERNAL_PATTERNS) {
      if (pattern.test(item.assumptions)) {
        violations.push(`"${item.task}" references internal artifact in assumptions`);
        break;
      }
    }
  }

  if (violations.length === 0) {
    return {
      category: "ASSUMPTION_SOURCE",
      status: "PASS",
      message: "All assumptions reference TOR/Q&A sources only",
    };
  }

  return {
    category: "ASSUMPTION_SOURCE",
    status: "FAIL",
    message: `${violations.length} line item(s) reference internal artifacts in assumptions`,
    details: violations.slice(0, 10),
  };
}

/**
 * Check that all Conf <= 4 items appear in the Risk Register (CARL RULE 15).
 */
function validateRiskRegisterCoverage(
  markdown: string,
  lineItems: ParsedLineItem[]
): StructuralValidationItem {
  const lowConfItems = lineItems.filter((i) => i.conf !== null && i.conf <= 4);

  if (lowConfItems.length === 0) {
    return {
      category: "RISK_REGISTER",
      status: "PASS",
      message: "No Conf <= 4 items requiring Risk Register entries",
    };
  }

  // Extract risk register section
  const riskMatch = markdown.match(/^#{1,3}\s+Risk\s+Register[\s\S]*?(?=^#{1,3}\s(?!Risk)|$)/im);
  const riskSection = riskMatch ? riskMatch[0].toLowerCase() : "";

  const missing: string[] = [];
  for (const item of lowConfItems) {
    // Check if task name appears in risk register (fuzzy — first 3 significant words)
    const taskWords = item.task.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
    const found = taskWords.length > 0 && taskWords.some((word) => riskSection.includes(word));
    if (!found) {
      missing.push(`"${item.task}" (Conf ${item.conf})`);
    }
  }

  if (missing.length === 0) {
    return {
      category: "RISK_REGISTER",
      status: "PASS",
      message: `All ${lowConfItems.length} Conf <= 4 items covered in Risk Register`,
    };
  }

  return {
    category: "RISK_REGISTER",
    status: "WARN",
    message: `${missing.length} of ${lowConfItems.length} Conf <= 4 items missing from Risk Register`,
    details: missing.slice(0, 10),
  };
}

/**
 * Check that Fixed Cost tab doesn't contain development tasks (CARL RULE 11).
 * Development tasks belong in Backend/Frontend.
 */
function validateTabOrganization(lineItems: ParsedLineItem[]): StructuralValidationItem {
  const DEV_KEYWORDS = [
    "content type", "migration", "integration", "custom module",
    "component", "view", "entity", "field", "taxonomy", "plugin development",
    "api endpoint", "graphql", "rest api",
  ];

  const fixedCostItems = lineItems.filter((i) => i.tab === "Fixed Cost");
  const violations: string[] = [];

  for (const item of fixedCostItems) {
    const taskLower = item.task.toLowerCase();
    const matchedKeyword = DEV_KEYWORDS.find((kw) => taskLower.includes(kw));
    if (matchedKeyword) {
      violations.push(`"${item.task}" (matched: ${matchedKeyword})`);
    }
  }

  if (violations.length === 0) {
    return {
      category: "TAB_ORGANIZATION",
      status: "PASS",
      message: "Fixed Cost tab contains only operational items",
    };
  }

  return {
    category: "TAB_ORGANIZATION",
    status: "WARN",
    message: `${violations.length} potential development task(s) in Fixed Cost tab`,
    details: violations.slice(0, 10),
  };
}

/**
 * Check that the share of line items lacking a matched benchmark stays below 10%.
 * Silent NO_BENCHMARK items otherwise let large estimates pass with no fidelity.
 */
function validateBenchmarkCoverage(report: ValidationReport): StructuralValidationItem {
  const total = report.items.length;
  if (total === 0) {
    return {
      category: "BENCHMARK_COVERAGE",
      status: "PASS",
      message: "No line items to validate",
    };
  }

  const ratio = report.noBenchmarkCount / total;
  if (ratio <= 0.1) {
    return {
      category: "BENCHMARK_COVERAGE",
      status: "PASS",
      message: `${report.noBenchmarkCount}/${total} line items without a matched benchmark (${(ratio * 100).toFixed(0)}%)`,
    };
  }

  return {
    category: "BENCHMARK_COVERAGE",
    status: "WARN",
    message: `${report.noBenchmarkCount}/${total} line items (${(ratio * 100).toFixed(0)}%) lack a matched benchmark — exceeds 10% threshold`,
    details: report.unmatchedRefs.slice(0, 10),
  };
}

/**
 * Run full validation: benchmark deviations + structural checks.
 *
 * When `engagementId` and `phaseNumber` are supplied, additionally runs the
 * structured validators (coverage, conf-formula, assumption, risk register,
 * integration tier) against the DB-backed `TorRequirement` / `LineItem`
 * rows and writes a `ValidationReport` row summarising the run.
 */
export async function validateEstimateFull(
  contentMd: string,
  techStack: string,
  engagementId?: string,
  phaseNumber?: string
): Promise<FullValidationReport> {
  const benchmark = await validateEstimate(contentMd);
  const lineItems = parseLineItems(contentMd);

  const structural: StructuralValidationItem[] = [
    validateAlwaysIncludeTasks(lineItems, techStack),
    validateAssumptionSources(lineItems),
    validateRiskRegisterCoverage(contentMd, lineItems),
    validateTabOrganization(lineItems),
    validateBenchmarkCoverage(benchmark),
  ];

  let structured: StructuredValidatorSummary | undefined;
  if (engagementId) {
    structured = await runStructuredValidators(
      engagementId,
      benchmark,
      phaseNumber ?? "1A"
    );
  }

  const hasFail =
    benchmark.failCount > 0 ||
    structural.some((s) => s.status === "FAIL") ||
    structured?.coverage.status === "FAIL" ||
    structured?.confFormula.status === "FAIL" ||
    structured?.assumption.status === "FAIL" ||
    structured?.riskRegister.status === "FAIL" ||
    structured?.integrationTier.status === "FAIL";

  const hasWarn =
    benchmark.warnCount > 0 ||
    structural.some((s) => s.status === "WARN") ||
    structured?.coverage.status === "WARN" ||
    structured?.confFormula.status === "WARN" ||
    structured?.assumption.status === "WARN" ||
    structured?.riskRegister.status === "WARN" ||
    structured?.integrationTier.status === "WARN";

  const overallStatus: "PASS" | "WARN" | "FAIL" = hasFail
    ? "FAIL"
    : hasWarn
      ? "WARN"
      : "PASS";

  return { benchmark, structural, overallStatus, structured };
}

/**
 * Runs the structured validators and writes a ValidationReport row.
 * Swallows all errors — a validator blow-up must not block the surrounding
 * benchmark+structural report.
 */
async function runStructuredValidators(
  engagementId: string,
  benchmark: ValidationReport,
  phaseNumber: string
): Promise<StructuredValidatorSummary | undefined> {
  try {
    const [coverage, confFormula, assumption, riskRegister, integrationTier] =
      await Promise.all([
        runCoverageValidation(engagementId),
        runConfFormulaValidation(engagementId),
        runAssumptionValidation(engagementId),
        runRiskRegisterValidation(engagementId),
        runIntegrationTierValidation(engagementId),
      ]);

    const gapCount = (coverage.details.gapCount as number | undefined) ?? 0;
    const orphanCount =
      (coverage.details.orphanCount as number | undefined) ?? 0;
    const confFormulaViolations =
      (confFormula.details.violationCount as number | undefined) ?? 0;
    const totalLineItems =
      (confFormula.details.totalLineItems as number | undefined) ?? 0;
    const assumptionDefects =
      (assumption.details.defectCount as number | undefined) ?? 0;
    const riskMissing =
      (riskRegister.details.missingCount as number | undefined) ?? 0;

    const confViolationRate =
      totalLineItems > 0 ? confFormulaViolations / totalLineItems : 0;

    const rawScore =
      1.0 -
      gapCount * 0.04 -
      orphanCount * 0.02 -
      confViolationRate * 0.5 -
      assumptionDefects * 0.02 -
      riskMissing * 0.02;
    const accuracyScore = Math.max(0, Math.min(1, rawScore));

    const allStatuses = [
      coverage.status,
      confFormula.status,
      assumption.status,
      riskRegister.status,
      integrationTier.status,
    ];
    const overallStatus = allStatuses.includes("FAIL")
      ? "FAIL"
      : allStatuses.includes("WARN")
        ? "WARN"
        : "PASS";

    let validationReportId: string | undefined;
    try {
      const row = await prisma.validationReport.create({
        data: {
          engagementId,
          phaseNumber,
          overallStatus,
          accuracyScore,
          gapCount,
          orphanCount,
          confFormulaViolations,
          noBenchmarkCount: benchmark.noBenchmarkCount,
          details: JSON.parse(
            JSON.stringify({
              coverage,
              confFormula,
              assumption,
              riskRegister,
              integrationTier,
            })
          ),
        },
      });
      validationReportId = row.id;
    } catch (err) {
      console.warn(
        `[validate-estimate] ValidationReport insert failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return {
      coverage,
      confFormula,
      assumption,
      riskRegister,
      integrationTier,
      accuracyScore,
      gapCount,
      orphanCount,
      confFormulaViolations,
      validationReportId,
    };
  } catch (err) {
    console.warn(
      `[validate-estimate] structured validators failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
