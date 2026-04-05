/**
 * Parses AI-generated estimate markdown into structured data
 * for the TabbedEstimate component and Excel export.
 */

import type { LineItem } from "@/components/estimate/LineItemRow";
import type { EstimateData } from "@/components/estimate/TabbedEstimate";
import type { EstimateTab, EstimateRow } from "@/lib/excel-export";
import { calcLowHigh } from "@/components/estimate/LineItemRow";

// ─── Markdown table parser ──────────────────────────────────────────────────

interface ParsedRow {
  task: string;
  description: string;
  hours: number;
  conf: number;
  lowHrs: number;
  highHrs: number;
  assumptionRef: string;
}

function findColumnIndices(headerCells: string[]): {
  task: number;
  description: number;
  hours: number;
  conf: number;
  low: number;
  high: number;
  assumption: number;
} {
  const h = headerCells.map((c) => c.toLowerCase());
  return {
    task: h.findIndex((c) => c === "task" || c.includes("module")),
    description: h.findIndex((c) => c.includes("description")),
    hours: h.findIndex((c) => c === "hours"),
    conf: h.findIndex((c) => c === "conf"),
    low: h.findIndex((c) => c.includes("low")),
    high: h.findIndex((c) => c.includes("high")),
    assumption: h.findIndex((c) => c.includes("assumption")),
  };
}

function parseTablesInSection(markdown: string, startPattern: RegExp, endPattern: RegExp): ParsedRow[] {
  const lines = markdown.split("\n");
  const rows: ParsedRow[] = [];

  let inSection = false;
  let inTable = false;
  let cols: ReturnType<typeof findColumnIndices> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (startPattern.test(trimmed)) {
      inSection = true;
      inTable = false;
      cols = null;
      continue;
    }

    if (inSection && endPattern.test(trimmed)) {
      break;
    }

    if (!inSection) continue;

    // Detect table header
    if (trimmed.startsWith("|") && trimmed.toLowerCase().includes("task") && !inTable) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      cols = findColumnIndices(cells);
      continue;
    }

    // Skip separator
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      if (cols) inTable = true;
      continue;
    }

    // Parse data row
    if (inTable && cols && trimmed.startsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());

      const task = cells[cols.task] ?? "";
      const description = cells[cols.description] ?? "";
      const hours = parseFloat(cells[cols.hours] ?? "");
      const conf = parseInt(cells[cols.conf] ?? "", 10);
      const lowHrs = parseFloat(cells[cols.low] ?? "");
      const highHrs = parseFloat(cells[cols.high] ?? "");
      const assumptionRef = cells[cols.assumption] ?? "";

      // Skip rows without valid hours
      if (isNaN(hours) && isNaN(lowHrs)) continue;
      // Skip empty task names
      if (!task) continue;

      rows.push({
        task,
        description,
        hours: isNaN(hours) ? lowHrs : hours,
        conf: isNaN(conf) ? 4 : (Math.min(6, Math.max(1, conf)) as number),
        lowHrs: isNaN(lowHrs) ? hours : lowHrs,
        highHrs: isNaN(highHrs) ? hours : highHrs,
        assumptionRef,
      });
    }

    // Reset table on new subsection heading (but stay in section)
    if (/^#{2,3}\s/.test(trimmed) && cols) {
      inTable = false;
      cols = null;
    }
  }

  return rows;
}

function toLineItems(rows: ParsedRow[], prefix: string): LineItem[] {
  return rows.map((row, idx) => ({
    id: `${prefix}-${idx + 1}`,
    task: row.task,
    description: row.description,
    conf: Math.min(6, Math.max(1, row.conf)) as 1 | 2 | 3 | 4 | 5 | 6,
    hours: row.hours,
    assumptionRef: row.assumptionRef || undefined,
  }));
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Parse estimate markdown into EstimateData for the TabbedEstimate component. */
export function parseEstimateMarkdown(markdown: string): EstimateData {
  // Match flexible heading patterns: "# Backend Tab", "## Backend Development Estimates", etc.
  const backendStart = /^#{1,2}\s+Backend\b/i;
  const frontendStart = /^#{1,2}\s+Frontend\b/i;
  const fixedStart = /^#{1,2}\s+Fixed\s+Cost/i;
  const aiStart = /^#{1,2}\s+AI\b/i;
  const endSections = /^#{1,2}\s+(Risk\s+Register|Assumption|Coverage|State\s+File|Total\s+Effort|Traceability|Integration\s+Req|Key\s+Assumption|Dependencies|Delivery)/i;

  const backend = parseTablesInSection(
    markdown,
    backendStart,
    new RegExp(`(${frontendStart.source})|(${fixedStart.source})|(${aiStart.source})|(${endSections.source})`, "i")
  );

  const frontend = parseTablesInSection(
    markdown,
    frontendStart,
    new RegExp(`(${fixedStart.source})|(${aiStart.source})|(${endSections.source})`, "i")
  );

  const fixed = parseTablesInSection(
    markdown,
    fixedStart,
    new RegExp(`(${aiStart.source})|(${endSections.source})`, "i")
  );

  const ai = parseTablesInSection(
    markdown,
    aiStart,
    endSections
  );

  return {
    backend: toLineItems(backend, "be"),
    frontend: toLineItems(frontend, "fe"),
    fixed: toLineItems(fixed, "fc"),
    ai: toLineItems(ai, "ai"),
  };
}

/** Convert EstimateData to EstimateTab[] for the Excel export API. */
export function estimateDataToExcelTabs(data: EstimateData): EstimateTab[] {
  const tabMap: { key: keyof EstimateData; name: string }[] = [
    { key: "backend", name: "Backend" },
    { key: "frontend", name: "Frontend" },
    { key: "fixed", name: "Fixed Cost Items" },
    { key: "ai", name: "AI" },
  ];

  return tabMap.map(({ key, name }) => ({
    name,
    rows: data[key].map((item): EstimateRow => {
      const { low, high } = calcLowHigh(item.hours, item.conf);
      return {
        task: item.task,
        description: item.description,
        conf: item.conf,
        hours: item.hours,
        lowHrs: low,
        highHrs: high,
        assumptionRef: item.assumptionRef,
      };
    }),
  }));
}
