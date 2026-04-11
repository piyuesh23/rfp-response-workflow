/**
 * Serializes EstimateData back to markdown table format.
 * Used when saving inline table edits as a new artefact version.
 */

import type { EstimateData, TabKey } from "@/components/estimate/TabbedEstimate";
import { calcLowHigh } from "@/components/estimate/LineItemRow";

const TAB_HEADINGS: Record<TabKey, string> = {
  backend: "## Backend",
  frontend: "## Frontend",
  fixed: "## Fixed Cost Items",
  ai: "## AI",
};

const COLUMNS = "| Task | Description | Hours | BenchmarkRef | Conf | Low Hrs | High Hrs | Assumptions |";
const SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | --- |";

export function serializeEstimateMarkdown(data: EstimateData): string {
  const sections: string[] = [];

  const tabs: TabKey[] = ["backend", "frontend", "fixed", "ai"];

  for (const tab of tabs) {
    const rows = data[tab];
    if (rows.length === 0) continue;

    const lines: string[] = [TAB_HEADINGS[tab], "", COLUMNS, SEPARATOR];

    for (const row of rows) {
      const { low, high } = calcLowHigh(row.hours, row.conf);
      lines.push(
        `| ${row.task} | ${row.description} | ${row.hours} | N/A | ${row.conf} | ${low} | ${high} | ${row.assumptionRef ?? ""} |`
      );
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
