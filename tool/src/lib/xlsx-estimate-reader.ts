/**
 * Reverse-engineers estimate data from a populated Master Estimate Template (.xlsx).
 * Uses the same column positions as template-populator.ts ESTIMATE_COLUMNS but reads instead of writes.
 */
import ExcelJS from "exceljs";

export interface XlsxEstimateRow {
  task: string;
  description: string;
  hours: number;
  conf: number;
  lowHrs: number;
  highHrs: number;
  assumptions: string;
  solutionOrExclusions: string;
  links: string;
  domain?: string;
}

export interface XlsxEstimateData {
  backend: XlsxEstimateRow[];
  frontend: XlsxEstimateRow[];
  fixedCost: XlsxEstimateRow[];
  ai: XlsxEstimateRow[];
  summary: {
    backendHours: { low: number; high: number };
    frontendHours: { low: number; high: number };
    fixedCostHours: { low: number; high: number };
    aiHours: { low: number; high: number };
    totalHours: { low: number; high: number };
  };
}

// Column mappings matching template-populator.ts ESTIMATE_COLUMNS (1-indexed)
const TAB_COLUMNS = {
  Backend: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, solutionOrExclusions: 10, links: 11,
  },
  Frontend: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, solutionOrExclusions: 10, links: 11,
  },
  "Fixed Cost Items": {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 11, solutionOrExclusions: 0, links: 13,
  },
  AI: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, solutionOrExclusions: 10, links: 11,
  },
} as const;

const DATA_START_ROW = 7;
const MAX_ROWS_PER_TAB = 500;

function getCellString(sheet: ExcelJS.Worksheet, row: number, col: number): string {
  if (col === 0) return "";
  const cell = sheet.getCell(row, col);
  const val = cell.value;
  if (val == null) return "";
  // Handle formula cells: { formula: '=...', result: 'text' }
  if (typeof val === "object" && "result" in (val as object)) {
    const result = (val as { result: unknown }).result;
    if (result == null) return "";
    return String(result);
  }
  if (typeof val === "object" && "text" in (val as object)) {
    return String((val as { text: unknown }).text ?? "");
  }
  if (typeof val === "object" && "richText" in (val as object)) {
    const rt = (val as { richText: Array<{ text: string }> }).richText;
    return rt.map((r) => r.text).join("");
  }
  return String(val);
}

function getCellNumber(sheet: ExcelJS.Worksheet, row: number, col: number): number {
  if (col === 0) return 0;
  const cell = sheet.getCell(row, col);
  const val = cell.value;
  if (val == null) return 0;
  // Handle formula cells: { formula: '=SUM(...)', result: 42 }
  if (typeof val === "object" && "result" in (val as object)) {
    const result = (val as { result: unknown }).result;
    if (result == null) return 0;
    const n = Number(result);
    return isNaN(n) ? 0 : n;
  }
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function isCellBold(sheet: ExcelJS.Worksheet, row: number, col: number): boolean {
  const cell = sheet.getCell(row, col);
  const font = cell.font as { bold?: boolean } | undefined;
  return font?.bold === true;
}

function readTab(
  sheet: ExcelJS.Worksheet,
  colMap: typeof TAB_COLUMNS[keyof typeof TAB_COLUMNS]
): XlsxEstimateRow[] {
  const rows: XlsxEstimateRow[] = [];
  let currentDomain: string | undefined;
  let consecutiveEmpty = 0;

  for (let rowIdx = DATA_START_ROW; rowIdx < DATA_START_ROW + MAX_ROWS_PER_TAB; rowIdx++) {
    const taskValue = getCellString(sheet, rowIdx, colMap.task);

    if (!taskValue.trim()) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3) break;
      continue;
    }
    consecutiveEmpty = 0;

    // Bold task cell = domain header row
    if (isCellBold(sheet, rowIdx, colMap.task)) {
      currentDomain = taskValue.trim();
      continue;
    }

    const row: XlsxEstimateRow = {
      task: taskValue.trim(),
      description: getCellString(sheet, rowIdx, colMap.description),
      hours: getCellNumber(sheet, rowIdx, colMap.hours),
      conf: getCellNumber(sheet, rowIdx, colMap.conf),
      lowHrs: getCellNumber(sheet, rowIdx, colMap.lowHrs),
      highHrs: getCellNumber(sheet, rowIdx, colMap.highHrs),
      assumptions: getCellString(sheet, rowIdx, colMap.assumptions),
      solutionOrExclusions: getCellString(sheet, rowIdx, colMap.solutionOrExclusions),
      links: getCellString(sheet, rowIdx, colMap.links),
      domain: currentDomain,
    };

    rows.push(row);
  }

  return rows;
}

function sumHours(rows: XlsxEstimateRow[]): { low: number; high: number } {
  return rows.reduce(
    (acc, r) => ({ low: acc.low + r.lowHrs, high: acc.high + r.highHrs }),
    { low: 0, high: 0 }
  );
}

function getWorksheetCaseInsensitive(
  workbook: ExcelJS.Workbook,
  name: string
): ExcelJS.Worksheet | undefined {
  const exact = workbook.getWorksheet(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return workbook.worksheets.find((ws) => ws.name.toLowerCase() === lower);
}

export async function readEstimateFromXlsx(buffer: Buffer): Promise<XlsxEstimateData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer);

  const backendSheet = getWorksheetCaseInsensitive(wb, "Backend");
  const frontendSheet = getWorksheetCaseInsensitive(wb, "Frontend");
  const fixedCostSheet = getWorksheetCaseInsensitive(wb, "Fixed Cost Items");
  const aiSheet = getWorksheetCaseInsensitive(wb, "AI");

  const backend = backendSheet ? readTab(backendSheet, TAB_COLUMNS.Backend) : [];
  const frontend = frontendSheet ? readTab(frontendSheet, TAB_COLUMNS.Frontend) : [];
  const fixedCost = fixedCostSheet ? readTab(fixedCostSheet, TAB_COLUMNS["Fixed Cost Items"]) : [];
  const ai = aiSheet ? readTab(aiSheet, TAB_COLUMNS.AI) : [];

  const backendHours = sumHours(backend);
  const frontendHours = sumHours(frontend);
  const fixedCostHours = sumHours(fixedCost);
  const aiHours = sumHours(ai);

  return {
    backend,
    frontend,
    fixedCost,
    ai,
    summary: {
      backendHours,
      frontendHours,
      fixedCostHours,
      aiHours,
      totalHours: {
        low: backendHours.low + frontendHours.low + fixedCostHours.low + aiHours.low,
        high: backendHours.high + frontendHours.high + fixedCostHours.high + aiHours.high,
      },
    },
  };
}

function rowsToMarkdownTable(rows: XlsxEstimateRow[], includeExclusions = false): string {
  if (rows.length === 0) return "_No items_\n";

  const header = includeExclusions
    ? "| Task | Description | Hrs | Conf | Low | High | Assumptions | Exclusions | Links |"
    : "| Task | Description | Hrs | Conf | Low | High | Assumptions | Solution | Links |";
  const sep = includeExclusions
    ? "|------|-------------|-----|------|-----|------|-------------|------------|-------|"
    : "|------|-------------|-----|------|-----|------|-------------|----------|-------|";

  const lines = [header, sep];

  let lastDomain: string | undefined;
  for (const r of rows) {
    if (r.domain && r.domain !== lastDomain) {
      lines.push(`| **${r.domain}** | | | | | | | | |`);
      lastDomain = r.domain;
    }
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${esc(r.task)} | ${esc(r.description)} | ${r.hours || ""} | ${r.conf || ""} | ${r.lowHrs || ""} | ${r.highHrs || ""} | ${esc(r.assumptions)} | ${esc(r.solutionOrExclusions)} | ${esc(r.links)} |`
    );
  }

  return lines.join("\n") + "\n";
}

export function xlsxEstimateToMarkdown(data: XlsxEstimateData): string {
  const { summary } = data;
  const lines: string[] = [];

  lines.push("# Estimate (Imported from XLSX)\n");

  lines.push("## Backend\n");
  lines.push(rowsToMarkdownTable(data.backend, false));

  lines.push("\n## Frontend\n");
  lines.push(rowsToMarkdownTable(data.frontend, true));

  lines.push("\n## Fixed Cost Items\n");
  lines.push(rowsToMarkdownTable(data.fixedCost, false));

  lines.push("\n## AI\n");
  lines.push(rowsToMarkdownTable(data.ai, false));

  lines.push("\n## Summary\n");
  lines.push("| Tab | Low Hrs | High Hrs |");
  lines.push("|-----|---------|----------|");
  lines.push(`| Backend | ${summary.backendHours.low} | ${summary.backendHours.high} |`);
  lines.push(`| Frontend | ${summary.frontendHours.low} | ${summary.frontendHours.high} |`);
  lines.push(`| Fixed Cost Items | ${summary.fixedCostHours.low} | ${summary.fixedCostHours.high} |`);
  lines.push(`| AI | ${summary.aiHours.low} | ${summary.aiHours.high} |`);
  lines.push(`| **Total** | **${summary.totalHours.low}** | **${summary.totalHours.high}** |`);

  return lines.join("\n");
}
