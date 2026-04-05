/**
 * Populates specific tabs of the Master Estimate Template (Excel).
 * Uses ExcelJS to load the template from S3, write data to specific sheets,
 * and re-upload the modified file.
 *
 * Tab population triggers:
 *   Phase 1 approved -> "Questions for RFP" + "Sales Detail"
 *   Phase 1A/3 approved -> "Backend" + "Frontend" + "Fixed Cost Items" + "AI"
 */

import ExcelJS from "exceljs";
import Anthropic from "@anthropic-ai/sdk";
import { downloadFile, uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

export interface TemplateStatus {
  questionsRfp?: boolean;
  salesDetail?: boolean;
  backend?: boolean;
  frontend?: boolean;
  fixedCost?: boolean;
  ai?: boolean;
}

// Column mappings per estimate tab (1-indexed column numbers matching template)
const ESTIMATE_COLUMNS = {
  Backend: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, solution: 10, links: 11,
  },
  Frontend: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, exclusions: 10, links: 11,
  },
  "Fixed Cost Items": {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 11, links: 13,
  },
  AI: {
    task: 2, description: 3, hours: 5, conf: 6,
    lowHrs: 7, highHrs: 8, assumptions: 9, solution: 10, links: 11,
  },
} as const;

const DATA_START_ROW = 7; // Row 6 = header, data starts at row 7

// ---- Template copy on engagement creation ----

/**
 * Copies the Master template to the engagement's S3 folder.
 * Returns the S3 key of the copied file.
 */
export async function copyMasterTemplate(engagementId: string): Promise<string> {
  // Try several known paths for the master template
  const candidatePaths = [
    "/app/templates/Master_Estimate_Template_Blank.xlsx",
    path.resolve(process.cwd(), "../templates/Master_Estimate_Template_Blank.xlsx"),
    path.resolve(process.cwd(), "templates/Master_Estimate_Template_Blank.xlsx"),
  ];

  let templateBuffer: Buffer | null = null;
  for (const p of candidatePaths) {
    try {
      templateBuffer = fs.readFileSync(p);
      break;
    } catch {
      // try next path
    }
  }

  if (!templateBuffer) {
    throw new Error(
      "Master template not found. Expected at /app/templates/Master_Estimate_Template_Blank.xlsx"
    );
  }

  const s3Key = `engagements/${engagementId}/estimates/Master_Estimate_Template.xlsx`;
  await uploadFile(
    s3Key,
    templateBuffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return s3Key;
}

// ---- Questions for RFP tab ----

interface QuestionRow {
  broadArea: string;
  torReference: string;
  question: string;
}

/**
 * Parses questions.md markdown into structured rows for the "Questions for RFP" tab.
 * Strips MCQ options and impact text, rephrases as open-text questions.
 */
function parseQuestionsMarkdown(markdown: string): QuestionRow[] {
  const rows: QuestionRow[] = [];
  let currentArea = "General";

  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect section headers (## Area Name)
    const sectionMatch = line.match(/^#{1,3}\s+(.+)/);
    if (sectionMatch) {
      const heading = sectionMatch[1].trim();
      // Skip meta headings
      if (
        !heading.toLowerCase().includes("clarifying questions") &&
        !heading.toLowerCase().includes("table of contents")
      ) {
        currentArea = heading;
      }
      i++;
      continue;
    }

    // Detect numbered or bulleted questions
    const questionMatch = line.match(
      /^(?:\d+[\.\)]\s*|\*\s+|-\s+)\*?\*?(?:\[([^\]]*)\])?\*?\*?\s*(.+)/
    );
    if (questionMatch) {
      const torRef = questionMatch[1] ?? "";
      let questionText = questionMatch[2].trim();

      // Collect continuation lines (indented or until next question/section)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (
          nextLine === "" ||
          /^#{1,3}\s/.test(nextLine) ||
          /^(?:\d+[\.\)]\s|\*\s|-\s)/.test(nextLine)
        ) {
          break;
        }
        questionText += " " + nextLine;
        j++;
      }

      // Strip MCQ options: remove "A) ..., B) ..., C) ..." patterns
      questionText = questionText.replace(
        /\s*(?:Options?:?\s*)?(?:[A-Z]\)\s*[^,\n]+(?:,\s*)?){2,}/gi,
        ""
      );

      // Strip "Impact of choosing..." sentences
      questionText = questionText.replace(
        /\s*Impact\s+(?:of\s+)?(?:choosing|selecting|this)[^.]*\./gi,
        ""
      );

      // Strip inline option markers like "(A) X (B) Y (C) Z"
      questionText = questionText.replace(
        /\s*\([A-Z]\)\s*[^(]*/g,
        (match) => {
          // Only strip if it looks like multiple options
          if (/\([A-Z]\)/.test(match)) return "";
          return match;
        }
      );

      // Clean up multiple spaces and trailing punctuation
      questionText = questionText.replace(/\s+/g, " ").trim();
      if (!questionText.endsWith("?") && !questionText.endsWith(".")) {
        questionText += "?";
      }

      if (questionText.length > 5) {
        rows.push({
          broadArea: currentArea,
          torReference: torRef,
          question: questionText,
        });
      }

      i = j;
      continue;
    }

    i++;
  }

  return rows;
}

interface RewrittenQuestion {
  topic: string;
  torReference: string;
  question: string;
  impact: string;
  comments: string;
}

/**
 * Uses Claude to rewrite questions from questions.md into the RFP format:
 * - Topic (broad area)
 * - TOR Reference (specific section/clause)
 * - Question with options phrased as possibilities
 * - Impact of each option on estimation (separate column)
 * - Additional comments for context not covered in other columns
 */
async function rewriteQuestionsForRfp(
  questionsMarkdown: string
): Promise<RewrittenQuestion[]> {
  const prompt = `You are reformatting clarifying questions for a client-facing RFP Q&A document.

Below is the raw questions markdown generated during TOR analysis. Each question in the source has a topic area, a TOR reference, options (A/B/C), and impact information. Rewrite ALL questions into a structured format for the Excel sheet.

For each question, produce FIVE fields:
1. **topic**: The broad area/domain the question belongs to (e.g., "Content Architecture", "Integrations", "Migration", "Frontend/Theming", "DevOps/Hosting", "SEO", "Security")
2. **torReference**: The specific TOR section, clause, or page being referenced. Extract this from the original question's context (e.g., "Section 3.2 - Content Types", "Page 12, Clause 4.1 - Integration Requirements"). If the original question mentions a specific requirement, reference it.
3. **question**: The question rewritten as a professional, client-facing question. Include:
   - The core question in clear, direct language
   - Available options phrased as possibilities (e.g., "Possible approaches include: (a) ..., (b) ..., (c) ...")
   - Keep all substantive options from the original question
4. **impact**: For each option listed in the question, describe its specific impact on estimation effort, timeline, or complexity. Be concrete about hours where possible (e.g., "Option (a): Adds approximately 40-60 hours for custom development. Option (b): Reduces effort by 20-30 hours using platform-native solution.")
5. **comments**: Any additional context, notes, or observations from the original question that don't fit in the other columns. If none, use an empty string.

CRITICAL RULES:
- You MUST include EVERY question from the source material. Do not skip or summarize.
- Do not use em-dashes or emoji
- Each question should be self-contained and understandable without additional context
- Options should present the real alternatives from the original question, not generic placeholders
- If the original question has A/B/C options, preserve all of them as possibilities
- Impact must be in a SEPARATE field, not embedded in the question text

SOURCE QUESTIONS:
${questionsMarkdown.slice(0, 15000)}

Respond ONLY with valid JSON in this format:
{ "questions": [ { "topic": "...", "torReference": "...", "question": "...", "impact": "...", "comments": "..." } ] }`;

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Extract JSON - handle cases where AI wraps in code blocks or adds preamble
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr) as { questions: RewrittenQuestion[] };
    const questions = parsed.questions ?? [];
    console.log(`[template-populator] AI rewrote ${questions.length} questions for RFP`);
    return questions;
  } catch (err) {
    console.error("[template-populator] rewriteQuestionsForRfp failed:", err);
    return [];
  }
}

/**
 * Populates the "Questions for RFP" sheet in the workbook.
 * Uses AI to rewrite questions with options and estimation impact.
 * Template: Row 2 = headers (A=Sr.No, B=Topic, C=Questions, D=URL reference)
 * Data starts at row 3.
 */
async function populateQuestionsTab(
  workbook: ExcelJS.Workbook,
  questionsMarkdown: string
): Promise<boolean> {
  const sheet = workbook.getWorksheet("Questions for RFP");
  if (!sheet) return false;

  // Unmerge any pre-existing merged cells below the header row
  const rangesToRemove: string[] = [];
  sheet.model.merges?.forEach((range) => {
    // Keep row 1 header merge, unmerge data rows
    if (!range.startsWith("A1") && !range.includes(":E1")) {
      rangesToRemove.push(range);
    }
  });
  for (const range of rangesToRemove) {
    sheet.unMergeCells(range);
  }

  // Template columns (row 2 headers already set):
  // A=Sr. No, B=Topic, C=TOR Reference, D=Questions, E=Impact on Estimates, F=Additional Comments

  // AI rewrite for professional RFP format with options, impact, and comments
  const rewritten = await rewriteQuestionsForRfp(questionsMarkdown);

  // Fall back to basic parsing if AI rewrite fails
  if (rewritten.length === 0) {
    const basicRows = parseQuestionsMarkdown(questionsMarkdown);
    if (basicRows.length === 0) return false;

    let rowIdx = 3;
    for (let i = 0; i < basicRows.length; i++) {
      sheet.getCell(rowIdx, 1).value = i + 1; // A: Sr. No
      sheet.getCell(rowIdx, 2).value = basicRows[i].broadArea; // B: Topic
      sheet.getCell(rowIdx, 3).value = basicRows[i].torReference; // C: TOR Reference
      sheet.getCell(rowIdx, 4).value = basicRows[i].question; // D: Questions
      sheet.getCell(rowIdx, 4).alignment = { wrapText: true, vertical: "top" };
      rowIdx++;
    }
    return true;
  }

  let rowIdx = 3;
  for (let i = 0; i < rewritten.length; i++) {
    const q = rewritten[i];
    sheet.getCell(rowIdx, 1).value = i + 1; // A: Sr. No
    sheet.getCell(rowIdx, 2).value = q.topic; // B: Topic
    sheet.getCell(rowIdx, 3).value = q.torReference; // C: TOR Reference
    sheet.getCell(rowIdx, 3).alignment = { wrapText: true, vertical: "top" };
    sheet.getCell(rowIdx, 4).value = q.question; // D: Questions
    sheet.getCell(rowIdx, 4).alignment = { wrapText: true, vertical: "top" };
    sheet.getCell(rowIdx, 5).value = q.impact; // E: Impact on Estimates
    sheet.getCell(rowIdx, 5).alignment = { wrapText: true, vertical: "top" };
    if (q.comments) {
      sheet.getCell(rowIdx, 6).value = q.comments; // F: Additional Comments
      sheet.getCell(rowIdx, 6).alignment = { wrapText: true, vertical: "top" };
    }
    rowIdx++;
  }

  return true;
}

// ---- Sales Detail tab (AI-driven) ----

// Merged rows in the Sales Detail sheet (section headers) - skip these
const SALES_DETAIL_MERGED_ROWS = new Set([1, 3, 12]);
// Grey fill color for fillable rows
const GREY_FILL = "FFEFEFEF";

interface SalesDetailContext {
  clientName: string;
  projectName: string | null;
  techStack: string;
  engagementType: string;
  torContent: string;
  researchContent: string;
}

/**
 * Uses Claude to populate the Sales Detail tab by answering each row's question
 * from TOR assessment + research content. Only fills grey rows, skips merged headers.
 * Never guesses - leaves blank if no answer found in source documents.
 */
async function populateSalesDetailTab(
  workbook: ExcelJS.Workbook,
  data: SalesDetailContext
): Promise<boolean> {
  const sheet = workbook.getWorksheet("Sales Detail");
  if (!sheet) return false;

  // Collect all row labels from grey, non-merged rows
  const rowQuestions: Array<{ row: number; label: string }> = [];
  for (let rowIdx = 2; rowIdx <= 30; rowIdx++) {
    if (SALES_DETAIL_MERGED_ROWS.has(rowIdx)) continue;

    // Check if this row has grey fill (fillable)
    const cellA = sheet.getCell(rowIdx, 1);
    const fillColor = (cellA.fill as ExcelJS.FillPattern)?.fgColor?.argb;
    if (fillColor !== GREY_FILL) continue;

    const label = cellA.value;
    if (!label) continue;

    const labelStr = String(label).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    rowQuestions.push({ row: rowIdx, label: labelStr });
  }

  if (rowQuestions.length === 0) return false;

  // Build the prompt for Claude
  const rowList = rowQuestions
    .map((rq, i) => `${i + 1}. Row ${rq.row}: "${rq.label}"`)
    .join("\n");

  const sourceContent = [
    data.torContent ? `## TOR Assessment\n${data.torContent}` : "",
    data.researchContent ? `## Research Summary\n${data.researchContent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!sourceContent) return false;

  const prompt = `You are filling out a Sales Detail form for a presales engagement.

Client: ${data.clientName}
Project: ${data.projectName ?? "N/A"}
Tech Stack: ${data.techStack.replace(/_/g, " ")}
Engagement Type: ${data.engagementType.replace(/_/g, " ")}

Below are the row labels from the Sales Detail sheet. For each row, extract the answer ONLY from the source documents provided below.

RULES:
- Only use information explicitly stated in the source documents
- Never guess, infer, or make up information
- If no answer is found in the sources, respond with "N/A" for that row
- Write answers as clean, structured text (no markdown, no bullet points, no headers)
- For multi-point answers, use comma-separated phrases or short sentences
- Keep answers concise but complete (max 2-3 sentences per row)
- Do not use em-dashes, semicolons, or emoji

ROW LABELS TO FILL:
${rowList}

SOURCE DOCUMENTS:
${sourceContent.slice(0, 15000)}

Respond in JSON format: { "answers": { "<row_number>": "<answer or N/A>" } }
Only include the JSON, no other text.`;

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON from response (handle code blocks and preamble)
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*"answers"[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    }
    const parsed = JSON.parse(jsonStr) as { answers: Record<string, string> };
    console.log(`[template-populator] AI populated ${Object.keys(parsed.answers ?? {}).length} Sales Detail rows`);

    let anyWritten = false;
    for (const rq of rowQuestions) {
      const answer = parsed.answers?.[String(rq.row)];
      if (answer && answer !== "N/A" && answer.trim().length > 0) {
        sheet.getCell(rq.row, 2).value = answer.trim();
        sheet.getCell(rq.row, 2).alignment = { wrapText: true, vertical: "top" };
        anyWritten = true;
      }
    }

    // Ensure key metadata rows are always populated (fallback if AI missed them)
    if (!sheet.getCell(4, 2).value && data.clientName) {
      sheet.getCell(4, 2).value = data.clientName;
      anyWritten = true;
    }
    if (!sheet.getCell(5, 2).value) {
      const estimateName = data.projectName
        ? `${data.projectName} - ${data.clientName}`
        : data.clientName;
      sheet.getCell(5, 2).value = estimateName;
      anyWritten = true;
    }

    return anyWritten;
  } catch {
    // AI call failed - fall back to basic metadata
    sheet.getCell(4, 2).value = data.clientName;
    sheet.getCell(5, 2).value = data.projectName
      ? `${data.projectName} - ${data.clientName}`
      : data.clientName;
    sheet.getCell(13, 2).value = data.engagementType.replace(/_/g, " ");
    return true;
  }
}

// ---- Estimate tabs (Backend, Frontend, Fixed Cost Items, AI) ----

interface EstimateRow {
  domain?: string;
  task: string;
  description: string;
  hours: number;
  conf: number;
  lowHrs: number;
  highHrs: number;
  assumptions: string;
  col6: string; // Proposed Solution (Backend/AI) or Exclusions (Frontend)
  links: string;
}

/**
 * Detect column positions from a markdown table header row.
 * Returns indices keyed by semantic name, or -1 if not found.
 */
function findEstimateColumnIndices(headerCells: string[]): {
  task: number;
  description: number;
  hours: number;
  conf: number;
  low: number;
  high: number;
  assumptions: number;
  solutionOrExclusions: number;
  links: number;
} {
  const h = headerCells.map((c) => c.toLowerCase().trim());
  return {
    task: h.findIndex((c) => c === "task" || c.includes("module")),
    description: h.findIndex((c) => c.includes("description")),
    hours: h.findIndex((c) => c === "hours"),
    conf: h.findIndex((c) => c === "conf"),
    low: h.findIndex((c) => c.includes("low")),
    high: h.findIndex((c) => c.includes("high")),
    assumptions: h.findIndex((c) => c.includes("assumption")),
    solutionOrExclusions: h.findIndex(
      (c) => c.includes("solution") || c.includes("exclusion") || c.includes("proposed")
    ),
    links: h.findIndex(
      (c) => c.includes("link") || c.includes("reference") || c.includes("url")
    ),
  };
}

/**
 * Parses estimate markdown into tab-separated row lists.
 * Uses flexible header-based column detection instead of rigid regex.
 * Compatible with any column count produced by Phase 1A and Phase 3.
 */
function parseEstimateTabSections(markdown: string): Record<string, EstimateRow[]> {
  const result: Record<string, EstimateRow[]> = {};
  const tabPattern = /^#\s+(Backend|Frontend|Fixed Cost Items|AI)\s+Tab/gim;
  const matches = [...markdown.matchAll(tabPattern)];

  for (let i = 0; i < matches.length; i++) {
    const tabName = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : markdown.length;
    const section = markdown.slice(start, end);

    const rows: EstimateRow[] = [];
    let currentDomain: string | undefined;

    // Split by ## sub-headers
    const subSections = section.split(/^##\s+/m);

    const skipSections = new Set([
      "Estimation Approach", "Summary", "Assumption Register",
      "Questions Resolved via Assumptions", "Confidence Assessment",
      "Coverage Checklist",
    ]);

    for (const sub of subSections) {
      if (!sub.trim()) continue;

      const subLines = sub.trim().split("\n");
      const title = subLines[0].trim();

      if (skipSections.has(title)) continue;
      currentDomain = title;

      let cols: ReturnType<typeof findEstimateColumnIndices> | null = null;
      let inTable = false;

      for (const line of subLines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|")) continue;

        const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());

        // Detect header row (contains "Task" or "Hours")
        if (!cols && (trimmed.toLowerCase().includes("task") || trimmed.toLowerCase().includes("hours"))) {
          cols = findEstimateColumnIndices(cells);
          inTable = false;
          continue;
        }

        // Skip separator row (|---|---|)
        if (/^\|[\s-:|]+\|$/.test(trimmed)) {
          if (cols) inTable = true;
          continue;
        }

        if (!inTable || !cols) continue;

        const task = cells[cols.task] ?? "";
        const description = cells[cols.description] ?? "";

        // Skip headers, separators, placeholders
        if (
          task.startsWith("[") || task === "Task" ||
          task.startsWith("---") || task.startsWith("**") || !task
        ) {
          continue;
        }

        const hours = parseFloat(cells[cols.hours] ?? "");
        const conf = parseFloat(cells[cols.conf] ?? "");
        const lowHrs = parseFloat(cells[cols.low] ?? "") || hours;
        const highHrs = parseFloat(cells[cols.high] ?? "") || hours;

        if (isNaN(hours) && !description) continue;

        const assumptions = (cells[cols.assumptions] ?? "").replace(/<br>/g, "\n");
        const col6 = cols.solutionOrExclusions >= 0 ? (cells[cols.solutionOrExclusions] ?? "") : "";
        const links = cols.links >= 0 ? (cells[cols.links] ?? "") : "";

        rows.push({
          domain: currentDomain,
          task,
          description,
          hours: isNaN(hours) ? 0 : hours,
          conf: isNaN(conf) ? 4 : conf,
          lowHrs,
          highHrs,
          assumptions,
          col6,
          links,
        });
      }
    }

    result[tabName] = rows;
  }

  return result;
}

/**
 * Populates estimate tabs in the workbook from parsed markdown data.
 */
function populateEstimateTabs(
  workbook: ExcelJS.Workbook,
  estimateMarkdown: string
): { backend: boolean; frontend: boolean; fixedCost: boolean; ai: boolean } {
  const tabData = parseEstimateTabSections(estimateMarkdown);
  const result = { backend: false, frontend: false, fixedCost: false, ai: false };

  const tabMapping: Array<{
    mdName: string;
    sheetName: string;
    resultKey: keyof typeof result;
    colMap: Record<string, number>;
  }> = [
    { mdName: "Backend", sheetName: "Backend", resultKey: "backend", colMap: ESTIMATE_COLUMNS.Backend },
    { mdName: "Frontend", sheetName: "Frontend", resultKey: "frontend", colMap: ESTIMATE_COLUMNS.Frontend },
    { mdName: "Fixed Cost Items", sheetName: "Fixed Cost Items", resultKey: "fixedCost", colMap: ESTIMATE_COLUMNS["Fixed Cost Items"] },
    { mdName: "AI", sheetName: "AI", resultKey: "ai", colMap: ESTIMATE_COLUMNS.AI },
  ];

  for (const { mdName, sheetName, resultKey, colMap } of tabMapping) {
    const rows = tabData[mdName];
    if (!rows || rows.length === 0) continue;

    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;

    let rowIdx = DATA_START_ROW;
    let currentDomain: string | undefined;

    for (const row of rows) {
      // Insert domain header row if domain changed
      if (row.domain && row.domain !== currentDomain) {
        currentDomain = row.domain;
        sheet.getCell(rowIdx, colMap.task).value = currentDomain;
        const domainCell = sheet.getCell(rowIdx, colMap.task);
        domainCell.font = { bold: true };
        rowIdx++;
      }

      sheet.getCell(rowIdx, colMap.task).value = row.task;
      sheet.getCell(rowIdx, colMap.description).value = row.description;
      sheet.getCell(rowIdx, colMap.hours).value = row.hours;
      sheet.getCell(rowIdx, colMap.conf).value = row.conf;
      sheet.getCell(rowIdx, colMap.lowHrs).value = row.lowHrs;
      sheet.getCell(rowIdx, colMap.highHrs).value = row.highHrs;
      sheet.getCell(rowIdx, colMap.assumptions).value = row.assumptions;

      // Tab-specific column
      if (sheetName === "Fixed Cost Items") {
        sheet.getCell(rowIdx, colMap.links).value = row.links;
      } else {
        const col6Key = sheetName === "Frontend" ? "exclusions" : "solution";
        if (col6Key in colMap) {
          sheet.getCell(rowIdx, (colMap as Record<string, number>)[col6Key]).value = row.col6;
        }
        sheet.getCell(rowIdx, colMap.links).value = row.links;
      }

      rowIdx++;
    }

    result[resultKey] = true;
  }

  return result;
}

// ---- Orchestration: called from phase approval ----

/**
 * Called when Phase 1 (TOR Assessment) is approved.
 * Populates "Questions for RFP" and "Sales Detail" tabs.
 */
export async function populateTemplateAfterPhase1(
  engagementId: string
): Promise<void> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      templateFileUrl: true,
      templateStatus: true,
      clientName: true,
      projectName: true,
      techStack: true,
      engagementType: true,
    },
  });

  if (!engagement?.templateFileUrl) return;

  const s3Key = engagement.templateFileUrl;
  const buffer = await downloadFile(s3Key);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer);

  const status = (engagement.templateStatus as TemplateStatus) ?? {};

  // Fetch Phase 1 artefact (TOR Assessment - contains both assessment + questions)
  const phase1 = await prisma.phase.findFirst({
    where: { engagementId, phaseNumber: "1" },
    include: {
      artefacts: {
        where: { artefactType: "TOR_ASSESSMENT" },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  // Gather source content for AI-driven population
  let torContent = phase1?.artefacts[0]?.contentMd ?? "";
  let researchContent = "";

  // Try original TOR markdown if assessment artefact is empty
  if (!torContent) {
    for (const torFile of ["tor/tor.md", "tor/TOR.md"]) {
      try {
        const buf = await downloadFile(`engagements/${engagementId}/${torFile}`);
        torContent = buf.toString("utf-8");
        break;
      } catch { /* try next */ }
    }
  }

  // Fetch Phase 0 research content for supplementary data
  try {
    const phase0 = await prisma.phase.findFirst({
      where: { engagementId, phaseNumber: "0" },
      include: {
        artefacts: {
          where: { artefactType: "RESEARCH" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    researchContent = phase0?.artefacts[0]?.contentMd ?? "";

    if (!researchContent) {
      try {
        const buf = await downloadFile(
          `engagements/${engagementId}/research/customer-research.md`
        );
        researchContent = buf.toString("utf-8");
      } catch { /* no research available */ }
    }
  } catch { /* non-fatal */ }

  // AI-driven Sales Detail (reads each row label, extracts from TOR + research)
  const salesOk = await populateSalesDetailTab(workbook, {
    clientName: engagement.clientName,
    projectName: engagement.projectName,
    techStack: engagement.techStack,
    engagementType: engagement.engagementType,
    torContent,
    researchContent,
  });
  if (salesOk) status.salesDetail = true;

  // Find questions markdown from S3 (AI writes directly to disk during phase execution)
  let questionsMd: string | undefined;
  try {
    const fileBuffer = await downloadFile(
      `engagements/${engagementId}/initial_questions/questions.md`
    );
    questionsMd = fileBuffer.toString("utf-8");
    console.log(`[template-populator] Found questions.md (${questionsMd.length} chars)`);
  } catch (err) {
    console.log(`[template-populator] questions.md not found in S3, trying TOR assessment artefact`);
    // Try extracting questions section from the TOR assessment artefact content
    if (torContent && torContent.includes("larifying")) {
      // The TOR assessment often contains a "Clarifying Questions" section
      const questionsStart = torContent.search(/#+\s*[Cc]larifying\s+[Qq]uestions/);
      if (questionsStart >= 0) {
        questionsMd = torContent.slice(questionsStart);
        console.log(`[template-populator] Extracted questions from TOR assessment (${questionsMd.length} chars)`);
      }
    }
  }

  if (questionsMd) {
    console.log(`[template-populator] Populating Questions for RFP tab...`);
    const questionsOk = await populateQuestionsTab(workbook, questionsMd);
    console.log(`[template-populator] Questions for RFP result: ${questionsOk}`);
    if (questionsOk) status.questionsRfp = true;
  } else {
    console.log(`[template-populator] No questions content found - skipping Questions for RFP tab`);
  }

  // Save back to S3
  const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await uploadFile(
    s3Key,
    outputBuffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { templateStatus: status as Record<string, boolean> },
  });
}

/**
 * Called when Phase 1A or Phase 3 (Estimates) is approved.
 * Populates Backend, Frontend, Fixed Cost Items, and AI tabs.
 */
export async function populateTemplateAfterEstimate(
  engagementId: string,
  phaseNumber: string
): Promise<void> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { templateFileUrl: true, templateStatus: true },
  });

  if (!engagement?.templateFileUrl) return;

  const s3Key = engagement.templateFileUrl;
  const buffer = await downloadFile(s3Key);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer);

  // Find the estimate markdown
  const phase = await prisma.phase.findFirst({
    where: { engagementId, phaseNumber },
    include: {
      artefacts: {
        where: { artefactType: "ESTIMATE" },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  let estimateMd = phase?.artefacts[0]?.contentMd;
  if (!estimateMd) {
    try {
      const fileBuffer = await downloadFile(
        `engagements/${engagementId}/estimates/optimistic-estimate.md`
      );
      estimateMd = fileBuffer.toString("utf-8");
    } catch {
      return; // No estimate content available
    }
  }

  if (!estimateMd) return;

  const status = (engagement.templateStatus as TemplateStatus) ?? {};
  const tabResults = populateEstimateTabs(workbook, estimateMd);

  if (tabResults.backend) status.backend = true;
  if (tabResults.frontend) status.frontend = true;
  if (tabResults.fixedCost) status.fixedCost = true;
  if (tabResults.ai) status.ai = true;

  // Save back to S3
  const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await uploadFile(
    s3Key,
    outputBuffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { templateStatus: status as Record<string, boolean> },
  });
}
