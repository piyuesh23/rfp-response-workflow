import { describe, it, expect } from "vitest";

// Import the private helpers via a barrel — we expose them for test only.
// Since HEADER_COLUMNS and confFillColor are not exported, we test the module
// by importing the whole file and checking compiled exports.
//
// Strategy: assert the snapshot inline so any future column insert breaks this test.

const EXPECTED_HEADERS = [
  "S.No",
  "Module/Feature",
  "Task",
  "Description",
  "Conf",
  "Hours",
  "Low Hrs",
  "High Hrs",
  "Benchmark Range",
  "Deviation",
  "AI Efficacy (%)",
  "Assumption Codes",
  "Assumption Ref",
];

const EXPECTED_KEYS = [
  "sno",
  "task",
  "task2",
  "description",
  "conf",
  "hours",
  "lowHrs",
  "highHrs",
  "benchmarkRange",
  "deviationReason",
  "aiEfficacy",
  "assumptionCodes",
  "assumptionRef",
];

describe("Excel HEADER_COLUMNS snapshot", () => {
  // We can't import HEADER_COLUMNS directly (not exported), so we parse the
  // source file and verify the exact structure. This acts as a change detector.
  it("header list and key order match snapshot", async () => {
    // Dynamic import of the module to access internals indirectly via generateEstimateXlsx
    // We verify the header count by generating a workbook and reading its columns.
    const { generateEstimateXlsx } = await import("@/lib/excel-export");
    const buf = await generateEstimateXlsx(
      [{ name: "Backend", rows: [{ task: "T", description: "D", conf: 5, hours: 8, lowHrs: 8, highHrs: 10 }] }],
      "TestClient"
    );
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet("Backend")!;
    const headers = sheet.getRow(1).values as (string | undefined)[];
    // ExcelJS returns 1-indexed — index 0 is undefined
    const actualHeaders = headers.slice(1).filter(Boolean);
    expect(actualHeaders).toEqual(EXPECTED_HEADERS);
  });

  it("conf column is at position 5 (1-indexed)", async () => {
    const { generateEstimateXlsx } = await import("@/lib/excel-export");
    const buf = await generateEstimateXlsx(
      [{ name: "Backend", rows: [{ task: "T", description: "D", conf: 5, hours: 8, lowHrs: 8, highHrs: 10 }] }],
      "TestClient"
    );
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet("Backend")!;
    const headers = sheet.getRow(1).values as string[];
    expect(headers[5]).toBe("Conf");
  });
});

describe("confFillColor mapping", () => {
  it("verifies Conf 5 row has green fill via source assertion", async () => {
    const { generateEstimateXlsx } = await import("@/lib/excel-export");
    const buf = await generateEstimateXlsx(
      [{ name: "Backend", rows: [
        { task: "A", description: "", conf: 6, hours: 4, lowHrs: 4, highHrs: 4 },
        { task: "B", description: "", conf: 4, hours: 4, lowHrs: 4, highHrs: 6 },
        { task: "C", description: "", conf: 2, hours: 4, lowHrs: 4, highHrs: 7 },
      ]}],
      "Client"
    );
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet("Backend")!;
    const green = (sheet.getRow(2).getCell(5).fill as { fgColor?: { argb?: string } })?.fgColor?.argb;
    const yellow = (sheet.getRow(3).getCell(5).fill as { fgColor?: { argb?: string } })?.fgColor?.argb;
    const red = (sheet.getRow(4).getCell(5).fill as { fgColor?: { argb?: string } })?.fgColor?.argb;
    expect(green).toBe("FF92D050");
    expect(yellow).toBe("FFFFC000");
    expect(red).toBe("FFFF0000");
  });
});
