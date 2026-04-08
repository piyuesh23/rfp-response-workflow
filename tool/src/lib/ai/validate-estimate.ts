/**
 * Post-generation estimate validation.
 * Parses estimate markdown, looks up BenchmarkRef values against the DB,
 * and flags deviations. Pure TypeScript — no AI calls.
 */

import { prisma } from "@/lib/db";

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
  items: ValidationItem[];
}

interface ParsedLineItem {
  task: string;
  tab: string;
  hours: number;
  benchmarkRef: string;
  hasDeviationNote: boolean;
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
  let colMap: { task: number; hours: number; benchmarkRef: number; assumptions: number } | null = null;
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
      trimmed.toLowerCase().includes("benchmarkref") &&
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

      if (hoursIdx >= 0 && bmIdx >= 0) {
        colMap = {
          task: taskIdx >= 0 ? taskIdx : 0,
          hours: hoursIdx,
          benchmarkRef: bmIdx,
          assumptions: assIdx >= 0 ? assIdx : -1,
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
      const benchmarkRef = (cells[colMap.benchmarkRef] ?? "").trim();
      const assumptions = colMap.assumptions >= 0 ? (cells[colMap.assumptions] ?? "") : "";

      if (task && !isNaN(hours) && hours > 0) {
        items.push({
          task,
          tab: currentTab,
          hours,
          benchmarkRef: benchmarkRef || "N/A",
          hasDeviationNote: assumptions.toUpperCase().includes("BENCHMARK DEVIATION"),
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
    items: [],
  };

  for (const item of lineItems) {
    const ref = item.benchmarkRef.toLowerCase().trim();

    if (ref === "n/a" || ref === "" || ref === "-") {
      report.noBenchmarkCount++;
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
