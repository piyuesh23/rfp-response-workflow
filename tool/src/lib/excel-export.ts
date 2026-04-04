import ExcelJS from "exceljs";

export interface EstimateRow {
  task: string;
  description: string;
  conf: number;
  hours: number;
  lowHrs: number;
  highHrs: number;
  assumptionRef?: string;
  aiEfficacy?: number;
}

export interface EstimateTab {
  name: string;
  rows: EstimateRow[];
}

const TAB_COLORS: Record<string, string> = {
  Backend: "FF4472C4",
  Frontend: "FF70AD47",
  "Fixed Cost Items": "FFED7D31",
  AI: "FF7030A0",
};

const HEADER_COLUMNS = [
  { header: "S.No", key: "sno", width: 6 },
  { header: "Module/Feature", key: "task", width: 28 },
  { header: "Task", key: "task2", width: 28 },
  { header: "Description", key: "description", width: 40 },
  { header: "Conf", key: "conf", width: 6 },
  { header: "Hours", key: "hours", width: 8 },
  { header: "Low Hrs", key: "lowHrs", width: 9 },
  { header: "High Hrs", key: "highHrs", width: 9 },
  { header: "AI Efficacy (%)", key: "aiEfficacy", width: 14 },
  { header: "Assumption Ref", key: "assumptionRef", width: 20 },
];

function confFillColor(conf: number): string {
  if (conf >= 5) return "FF92D050"; // green
  if (conf === 4) return "FFFFC000"; // yellow
  return "FFFF0000"; // red
}

export async function generateEstimateXlsx(
  tabs: EstimateTab[],
  clientName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QED42 Presales Tool";
  workbook.created = new Date();

  const tabNames = ["Backend", "Frontend", "Fixed Cost Items", "AI"];

  for (const tabName of tabNames) {
    const tabData = tabs.find((t) => t.name === tabName);
    const rows = tabData?.rows ?? [];

    const sheet = workbook.addWorksheet(tabName, {
      properties: { tabColor: { argb: TAB_COLORS[tabName] } },
    });

    // Set columns
    sheet.columns = HEADER_COLUMNS;

    // Header row styling
    const headerRow = sheet.getRow(1);
    headerRow.height = 20;
    HEADER_COLUMNS.forEach((_, colIndex) => {
      const cell = headerRow.getCell(colIndex + 1);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Data rows
    rows.forEach((row, idx) => {
      const dataRow = sheet.addRow({
        sno: idx + 1,
        task: row.task,
        task2: row.task,
        description: row.description,
        conf: row.conf,
        hours: row.hours,
        lowHrs: row.lowHrs,
        highHrs: row.highHrs,
        aiEfficacy: row.aiEfficacy ?? null,
        assumptionRef: row.assumptionRef ?? "",
      });
      dataRow.height = 18;

      // Style all cells in row
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
        cell.alignment = { vertical: "middle", wrapText: true };
      });

      // Conf cell color-coding (column 5)
      const confCell = dataRow.getCell(5);
      confCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: confFillColor(row.conf) },
      };
      confCell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Totals row
    if (rows.length > 0) {
      const dataStartRow = 2;
      const dataEndRow = rows.length + 1;
      const totalsRow = sheet.addRow({
        sno: "",
        task: "TOTAL",
        task2: "",
        description: "",
        conf: "",
        hours: { formula: `SUM(F${dataStartRow}:F${dataEndRow})` },
        lowHrs: { formula: `SUM(G${dataStartRow}:G${dataEndRow})` },
        highHrs: { formula: `SUM(H${dataStartRow}:H${dataEndRow})` },
        aiEfficacy: null,
        assumptionRef: "",
      });
      totalsRow.height = 20;
      totalsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E1F2" },
        };
        cell.border = {
          top: { style: "medium" },
          bottom: { style: "medium" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle" };
      });
    }
  }

  // Write to buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

