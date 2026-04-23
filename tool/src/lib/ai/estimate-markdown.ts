/**
 * Helpers to render estimate line items and risk register rows into the
 * markdown table format used by `estimates/optimistic-estimate.md`. Used by
 * the gap-fix server-side patcher so the AI doesn't have to rewrite 55KB
 * of markdown just to append a few rows.
 */
import type { EstimateLineItem } from "./sidecar-extractors";

export const CONF_BUFFER: Record<number, number> = {
  1: 1.0,
  2: 0.75,
  3: 0.5,
  4: 0.5,
  5: 0.25,
  6: 0,
};

function escapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function computeHighHrs(hours: number, conf: number): number {
  const buffer = CONF_BUFFER[conf] ?? 0.5;
  return Math.round(hours * (1 + buffer));
}

/**
 * Render a single line item as a markdown table row matching the
 * existing estimate table format. Returns the row WITHOUT a trailing newline.
 *
 * Columns: Task | Description | Hours | BenchmarkRef | Conf | Low Hrs |
 *          High Hrs | Assumptions | Proposed Solution | Reference Links
 */
export function renderLineItemRow(
  li: EstimateLineItem,
  extras: { assumptions?: string; proposedSolution?: string; referenceLinks?: string } = {}
): string {
  const cells = [
    escapePipes(li.task),
    escapePipes(li.description),
    String(li.hours),
    li.benchmarkRef ? escapePipes(li.benchmarkRef) : "N/A",
    String(li.conf),
    String(li.lowHrs),
    String(li.highHrs),
    escapePipes(extras.assumptions ?? ""),
    escapePipes(extras.proposedSolution ?? ""),
    escapePipes(extras.referenceLinks ?? ""),
  ];
  return `| ${cells.join(" | ")} |`;
}

export interface RiskRegisterRow {
  task: string;
  tab: string;
  conf: number;
  risk: string;
  openQuestion: string;
  action: string;
  hoursAtRisk: number;
}

/**
 * Render a risk register row. Columns:
 * Task | Tab | Conf | Risk/Dependency | Open Question for PM/Client |
 * Recommended Action | Hours at Risk
 */
export function renderRiskRow(r: RiskRegisterRow): string {
  const cells = [
    escapePipes(r.task),
    escapePipes(r.tab),
    String(r.conf),
    escapePipes(r.risk),
    escapePipes(r.openQuestion),
    escapePipes(r.action),
    String(r.hoursAtRisk),
  ];
  return `| ${cells.join(" | ")} |`;
}

/**
 * Append a row to a markdown table identified by a heading regex. The table
 * is assumed to have a header row and a separator row; the new row is inserted
 * just before the next blank line or heading.
 *
 * Returns the mutated document. If the heading is not found, returns the
 * original document unchanged (caller can detect this by comparison).
 */
export function appendRowToTableBelowHeading(
  markdown: string,
  headingRegex: RegExp,
  rowText: string
): string {
  const lines = markdown.split("\n");
  const headingIdx = lines.findIndex((l) => headingRegex.test(l));
  if (headingIdx === -1) return markdown;

  // Find the end of the table: walk forward past heading → blank → header → separator → rows...
  // Stop at the first line that is either blank+blank, a new heading, or end of file.
  let i = headingIdx + 1;
  // Skip any blank lines after the heading
  while (i < lines.length && lines[i].trim() === "") i++;
  // Skip header + separator (two lines)
  if (i < lines.length && lines[i].startsWith("|")) i++; // header
  if (i < lines.length && lines[i].startsWith("|")) i++; // separator
  // Walk rows
  while (i < lines.length && lines[i].startsWith("|")) i++;
  // `i` now points at the first line AFTER the table (blank or heading or EOF)

  const before = lines.slice(0, i);
  const after = lines.slice(i);
  return [...before, rowText, ...after].join("\n");
}

/**
 * Replace the ESTIMATE-LINEITEMS-JSON sidecar block at the end of the markdown
 * with a freshly-serialised version. If no sidecar exists, appends a new one.
 */
export function replaceEstimateSidecar(
  markdown: string,
  lineItems: EstimateLineItem[]
): string {
  const sidecarRe = /<!--\s*ESTIMATE-LINEITEMS-JSON[\s\S]*?-->/;
  const body = JSON.stringify({ lineItems }, null, 2);
  const block = `<!-- ESTIMATE-LINEITEMS-JSON\n${body}\n-->`;
  if (sidecarRe.test(markdown)) {
    return markdown.replace(sidecarRe, block);
  }
  return markdown.trimEnd() + "\n\n```\n" + block + "\n```\n";
}
