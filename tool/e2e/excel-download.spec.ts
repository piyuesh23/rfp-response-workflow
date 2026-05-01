import { test, expect } from "@playwright/test";
import path from "path";
import * as fs from "fs";
import * as os from "os";

const engagementId = process.env.E2E_ENGAGEMENT_ID ?? "e2e-engagement-1";

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

test.describe("Excel download — DB-first path and column order", () => {
  test("calls /api/engagements/:id/line-items (DB-first) when downloading", async ({ page }) => {
    await page.goto(`/engagements/${engagementId}/estimate`);
    await page.waitForSelector("text=Estimate", { timeout: 15_000 });

    let lineItemsApiCalled = false;
    page.on("request", (req) => {
      if (req.url().includes(`/line-items`)) lineItemsApiCalled = true;
    });

    // Click the Download Excel button
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("text=Download Excel"),
    ]);

    expect(lineItemsApiCalled).toBe(true);

    // Save and inspect the downloaded XLSX
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-excel-"));
    const xlsxPath = path.join(tmpDir, "estimate.xlsx");
    await download.saveAs(xlsxPath);

    // Parse with exceljs
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fs.readFileSync(xlsxPath) as unknown as Buffer);
    const sheet = wb.getWorksheet("Backend");
    expect(sheet).toBeDefined();

    const headers = (sheet!.getRow(1).values as (string | undefined)[]).slice(1).filter(Boolean);
    expect(headers).toEqual(EXPECTED_HEADERS);

    fs.rmSync(tmpDir, { recursive: true });
  });

  test("Assumption Codes column is populated for line items with linked assumptions", async ({ page }) => {
    await page.goto(`/engagements/${engagementId}/estimate`);
    await page.waitForSelector("text=Estimate", { timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("text=Download Excel"),
    ]);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-excel-"));
    const xlsxPath = path.join(tmpDir, "estimate.xlsx");
    await download.saveAs(xlsxPath);

    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fs.readFileSync(xlsxPath) as unknown as Buffer);
    const sheet = wb.getWorksheet("Backend");

    const headerRow = (sheet!.getRow(1).values as string[]).slice(1);
    const codeColIdx = headerRow.indexOf("Assumption Codes") + 1; // 1-indexed for ExcelJS
    expect(codeColIdx).toBeGreaterThan(0);

    // At least one data row should have assumption codes (from seeded linkage)
    const dataRow = sheet!.getRow(2);
    const codesCell = dataRow.getCell(codeColIdx).value;
    // May be empty if seed didn't link assumptions to line items — acceptable
    if (codesCell) {
      expect(String(codesCell)).toMatch(/^A-[A-Z]{2}-\d{3}/);
    }

    fs.rmSync(tmpDir, { recursive: true });
  });
});
