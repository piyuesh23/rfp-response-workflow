/**
 * Background worker for processing ZIP-based RFP imports.
 * Extracts files, runs AI inference, matches accounts, creates ImportItems.
 * Supports parallel folder processing (5 concurrent), AI rate limiting,
 * pause/resume, and auto-confirm mode.
 */
import { Worker } from "bullmq";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/db";
import { downloadFile, uploadFile } from "@/lib/storage";
import { extractTextFromPdf } from "@/lib/pdf-extractor";
import { extractTextFromDocx } from "@/lib/docx-extractor";
import { readEstimateFromXlsx, xlsxEstimateToMarkdown } from "@/lib/xlsx-estimate-reader";
import { inferEngagementFromText, inferFromSecondaryDocument, classifyFileType } from "@/lib/ai/infer-engagement";
import { classifyDocument, isLikelyTemplate } from "@/lib/ai/classify-document";
import { extractDeliverables } from "@/lib/ai/extract-deliverables";
import { convertToMarkdown } from "@/lib/ai/markdown-converter";
import { aiLimiter } from "@/lib/ai/rate-limiter";
import { redisConnection, ImportJobData } from "@/lib/queue";
import { ArtefactType } from "@/generated/prisma/client";
import {
  getAutoConfirmMinAccuracyScore,
  getOverallAccuracyForEngagement,
} from "@/lib/accuracy";

const FOLDER_CONCURRENCY = 5;

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isDocx(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

function isXlsx(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}

function isSupportedFile(name: string): boolean {
  return isPdf(name) || isDocx(name) || isXlsx(name);
}

interface AccountRecord {
  id: string;
  canonicalName: string;
  aliases: string[];
}

/**
 * Fuzzy match an inferred client name against a pre-loaded list of accounts.
 * Returns the best matching account ID or null.
 */
function findMatchingAccountFromCache(
  clientName: string,
  accounts: AccountRecord[]
): string | null {
  if (!clientName) return null;

  const needle = clientName.toLowerCase().trim();

  // Exact or substring match first
  for (const acc of accounts) {
    const canon = acc.canonicalName.toLowerCase();
    if (canon === needle || needle.includes(canon) || canon.includes(needle)) {
      return acc.id;
    }
    for (const alias of acc.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === needle || needle.includes(aliasLower) || aliasLower.includes(needle)) {
        return acc.id;
      }
    }
  }

  // Levenshtein distance <= 3
  for (const acc of accounts) {
    if (levenshtein(acc.canonicalName.toLowerCase(), needle) <= 3) {
      return acc.id;
    }
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Group ZIP entries by their top-level folder.
 * Root-level files go into a "__root__" group.
 */
function groupEntriesByFolder(
  entries: AdmZip.IZipEntry[]
): Map<string, AdmZip.IZipEntry[]> {
  const groups = new Map<string, AdmZip.IZipEntry[]>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const name = entry.entryName;
    // Skip macOS resource forks and hidden files
    if (name.includes("__MACOSX") || name.split("/").some((p) => p.startsWith("."))) {
      continue;
    }
    if (!isSupportedFile(name)) continue;

    const parts = name.split("/").filter(Boolean);
    // If file is directly in root (no subfolder), group as __root__
    const folder = parts.length > 1 ? parts[0] : "__root__";

    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(entry);
  }

  return groups;
}

/**
 * Select the primary TOR file from a group of files.
 * Prefers files classified as TOR, then largest PDF.
 */
function selectPrimaryFile(entries: AdmZip.IZipEntry[]): AdmZip.IZipEntry {
  // Prefer files classified as TOR
  const torFiles = entries.filter(
    (e) => classifyFileType(e.name) === "TOR"
  );
  if (torFiles.length > 0) {
    return torFiles.reduce((a, b) =>
      (a.header.size ?? 0) > (b.header.size ?? 0) ? a : b
    );
  }

  // Fallback: largest PDF, then largest DOCX
  const pdfs = entries.filter((e) => isPdf(e.name));
  if (pdfs.length > 0) {
    return pdfs.reduce((a, b) =>
      (a.header.size ?? 0) > (b.header.size ?? 0) ? a : b
    );
  }

  // Fallback: largest file
  return entries.reduce((a, b) =>
    (a.header.size ?? 0) > (b.header.size ?? 0) ? a : b
  );
}

interface ProcessedFileRecord {
  name: string;
  fullPath: string;
  type: string;
  isSubmission: boolean;
  extractedText: boolean;
  artefactCreated: boolean;
  inferredBudget?: number | null;
  inferredTimeline?: string | null;
  inferredFinalCost?: number | null;
  classifiedType?: string;
  classificationConfidence?: number;
  classificationReasoning?: string;
  deliverableMetadata?: Record<string, unknown> | null;
  isTemplate?: boolean;
  combinedMetadata?: { technical: Record<string, unknown> | null; financial: Record<string, unknown> | null } | null;
  /** Polished markdown for PROPOSAL/TOR/FINANCIAL docs — produced in the worker so the confirm route stays fast. */
  contentMd?: string | null;
}

/**
 * Process a single folder from the ZIP: extract text, run AI inference,
 * match account, create ImportItem.
 */
async function processOneFolder(
  folderName: string,
  folderEntries: AdmZip.IZipEntry[],
  importJobId: string,
  accounts: AccountRecord[]
): Promise<void> {
  // Build files metadata — detect submissions subfolder
  const filesMetadata = folderEntries.map((e) => {
    const fileName = e.name.split("/").pop() || e.name;
    const pathLower = e.entryName.toLowerCase();
    const isSubmission = /\/(submissions?|final)\//i.test(pathLower);
    return {
      name: fileName,
      fullPath: e.entryName,
      type: classifyFileType(fileName) as string,
      sizeBytes: e.header.size ?? 0,
      isPrimary: false,
      isSubmission,
    };
  });

  // Select primary file
  const primaryEntry = selectPrimaryFile(folderEntries);
  const primaryFileName = primaryEntry.name.split("/").pop() || primaryEntry.name;
  filesMetadata.forEach((f) => {
    if (f.fullPath === primaryEntry.entryName) f.isPrimary = true;
  });

  const processedFileRecords: ProcessedFileRecord[] = [];

  // Extract text from primary file first
  let extractedText = "";
  try {
    const fileBuffer = primaryEntry.getData();
    if (isPdf(primaryEntry.name)) {
      const result = await extractTextFromPdf(fileBuffer);
      extractedText = result.text;
    } else if (isDocx(primaryEntry.name)) {
      const result = await extractTextFromDocx(fileBuffer);
      extractedText = result.text;
    }
  } catch (extractErr) {
    console.warn(
      `[import-worker] Text extraction failed for ${primaryEntry.entryName}: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`
    );
  }

  // AI classify and extract metadata for primary file
  const primaryMeta = filesMetadata.find((f) => f.fullPath === primaryEntry.entryName);
  let primaryClassifiedType: string = primaryMeta ? classifyFileType(primaryMeta.name) : "OTHER";
  let primaryClassificationConfidence = 0;
  let primaryClassificationReasoning = "";
  let primaryDeliverableMetadata: Record<string, unknown> | null = null;

  if (extractedText.length >= 200) {
    try {
      const classification = await aiLimiter.execute(() => classifyDocument(extractedText));
      primaryClassifiedType = classification.documentType;
      primaryClassificationConfidence = classification.confidence;
      primaryClassificationReasoning = classification.reasoning;
    } catch {
      // Keep filename-based classification as fallback
    }

    if (primaryClassificationConfidence >= 0.6) {
      try {
        primaryDeliverableMetadata = await aiLimiter.execute(() =>
          extractDeliverables(extractedText, primaryClassifiedType)
        );
      } catch {
        // Non-fatal — proceed without metadata
      }
    }
  }

  // Combined proposal detection
  let combinedMetadata: { technical: Record<string, unknown> | null; financial: Record<string, unknown> | null } | null = null;
  if (primaryClassifiedType === "PROPOSAL" && primaryClassificationConfidence >= 0.7) {
    try {
      const { detectCombinedProposal } = await import("@/lib/ai/classify-document");
      const combined = await aiLimiter.execute(() => detectCombinedProposal(extractedText));
      if (combined.isCombined && combined.technicalSection && combined.financialSection) {
        const techText = extractedText.slice(combined.technicalSection.startOffset, combined.technicalSection.endOffset);
        const finText = extractedText.slice(combined.financialSection.startOffset, combined.financialSection.endOffset);
        const [techMeta, finMeta] = await Promise.all([
          aiLimiter.execute(() => extractDeliverables(techText, "PROPOSAL")),
          aiLimiter.execute(() => extractDeliverables(finText, "FINANCIAL")),
        ]);
        combinedMetadata = { technical: techMeta, financial: finMeta };
      }
    } catch {
      // Non-fatal
    }
  }

  // Template detection for primary file
  let primaryIsTemplate = false;
  if (primaryClassifiedType === "ESTIMATE" && extractedText.length > 0) {
    const templateCheck = isLikelyTemplate(extractedText);
    if (templateCheck.isTemplate) {
      primaryIsTemplate = true;
      primaryClassifiedType = "OTHER";
      primaryClassificationConfidence = 0.3;
      primaryClassificationReasoning = `Downgraded from ESTIMATE: ${templateCheck.reason}`;
    }
  }

  // Update filesMetadata type for primary file if AI confidence is high enough
  if (primaryMeta && primaryClassificationConfidence >= 0.6) {
    primaryMeta.type = primaryClassifiedType as typeof primaryMeta.type;
  }

  // Track primary file in processedFileRecords
  if (primaryMeta) {
    processedFileRecords.push({
      name: primaryMeta.name,
      fullPath: primaryMeta.fullPath,
      type: primaryMeta.type,
      isSubmission: primaryMeta.isSubmission,
      extractedText: extractedText.length > 0,
      artefactCreated: false,
      classifiedType: primaryClassifiedType,
      classificationConfidence: primaryClassificationConfidence,
      classificationReasoning: primaryClassificationReasoning,
      deliverableMetadata: primaryDeliverableMetadata,
      isTemplate: primaryIsTemplate,
      ...(combinedMetadata !== null ? { combinedMetadata } : {}),
    });
  }

  // Run AI inference on primary TOR if we got enough text — rate-limited
  let inferred: Awaited<ReturnType<typeof inferEngagementFromText>> | null = null;
  if (extractedText.length >= 100) {
    try {
      inferred = await aiLimiter.execute(() => inferEngagementFromText(extractedText));
    } catch (inferErr) {
      console.warn(
        `[import-worker] AI inference failed for ${folderName}: ${inferErr instanceof Error ? inferErr.message : String(inferErr)}`
      );
    }
  }

  // Process secondary files (non-primary)
  let mergedEstimatedBudget: number | null = inferred?.estimatedBudget ?? null;
  let mergedDeliveryTimeline: string | null = inferred?.deliveryTimeline ?? null;
  let mergedFinalCost: number | null = inferred?.finalCostSubmitted ?? null;

  for (const fileMeta of filesMetadata) {
    if (fileMeta.fullPath === primaryEntry.entryName) continue; // already processed

    let secondaryText = "";
    let extractedOk = false;
    let xlsxSkipAiClassify = false;

    const record: ProcessedFileRecord = {
      name: fileMeta.name,
      fullPath: fileMeta.fullPath,
      type: fileMeta.type,
      isSubmission: fileMeta.isSubmission,
      extractedText: false,
      artefactCreated: false,
      classifiedType: classifyFileType(fileMeta.name),
      classificationConfidence: 0,
      classificationReasoning: "",
      deliverableMetadata: null,
    };

    try {
      const entry = folderEntries.find((e) => e.entryName === fileMeta.fullPath);
      if (entry) {
        const fileBuffer = entry.getData();
        if (isPdf(fileMeta.name)) {
          const result = await extractTextFromPdf(fileBuffer);
          secondaryText = result.text;
          extractedOk = secondaryText.length > 0;
        } else if (isDocx(fileMeta.name)) {
          const result = await extractTextFromDocx(fileBuffer);
          secondaryText = result.text;
          extractedOk = secondaryText.length > 0;
        } else if (isXlsx(fileMeta.name)) {
          try {
            const xlsxData = await readEstimateFromXlsx(fileBuffer);
            const totalItems =
              xlsxData.backend.length +
              xlsxData.frontend.length +
              xlsxData.fixedCost.length +
              xlsxData.design.length +
              xlsxData.ai.length;
            if (totalItems > 0) {
              secondaryText = xlsxEstimateToMarkdown(xlsxData);
              extractedOk = true;
              xlsxSkipAiClassify = true;

              // XLSX template detection: flag as template if very few items
              if (totalItems < 3) {
                record.classifiedType = "OTHER";
                record.classificationConfidence = 0.3;
                record.isTemplate = true;
                record.classificationReasoning = `XLSX template detected: only ${totalItems} line items — likely a blank template`;
              } else {
                // XLSX files are definitively estimates — skip AI classification
                record.classifiedType = "ESTIMATE";
                record.classificationConfidence = 0.95;
                record.classificationReasoning = `XLSX estimate sheet with ${totalItems} line items across ${[
                  xlsxData.backend.length > 0 && "Backend",
                  xlsxData.frontend.length > 0 && "Frontend",
                  xlsxData.fixedCost.length > 0 && "Fixed Cost",
                  xlsxData.design.length > 0 && "Design",
                  xlsxData.ai.length > 0 && "AI",
                ]
                  .filter(Boolean)
                  .join(", ")} tabs`;
                fileMeta.type = "ESTIMATE";
              }
              record.deliverableMetadata = {
                totalHours: xlsxData.summary.totalHours,
                hoursByTab: {
                  backend: xlsxData.summary.backendHours,
                  frontend: xlsxData.summary.frontendHours,
                  fixedCost: xlsxData.summary.fixedCostHours,
                  design: xlsxData.summary.designHours,
                  ai: xlsxData.summary.aiHours,
                },
                lineItemCount: totalItems,
                rawData: xlsxData,
              };
            }
          } catch (xlsxErr) {
            console.warn(
              `[import-worker] XLSX parsing failed for ${fileMeta.name}: ${xlsxErr instanceof Error ? xlsxErr.message : String(xlsxErr)}`
            );
          }
        }
      }
    } catch (extractErr) {
      console.warn(
        `[import-worker] Secondary extraction failed for ${fileMeta.fullPath}: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`
      );
    }

    record.extractedText = extractedOk;

    // AI classify and extract metadata for non-XLSX secondary files
    if (!xlsxSkipAiClassify && extractedOk && secondaryText.length >= 200) {
      try {
        const classification = await aiLimiter.execute(() => classifyDocument(secondaryText));
        // Only overwrite filename-based classification if AI actually succeeded
        if (classification.confidence > 0 && classification.documentType !== "OTHER") {
          record.classifiedType = classification.documentType;
          record.classificationConfidence = classification.confidence;
          record.classificationReasoning = classification.reasoning;
        } else if (record.classifiedType === "OTHER") {
          // Only accept AI OTHER if filename also said OTHER
          record.classifiedType = classification.documentType;
          record.classificationConfidence = classification.confidence;
          record.classificationReasoning = classification.reasoning;
        }
      } catch (classifyErr) {
        // Keep filename-based classification as fallback
        console.warn(
          `[import-worker] AI classification failed for ${fileMeta.name}: ${classifyErr instanceof Error ? classifyErr.message : String(classifyErr)}`
        );
      }

      // Template detection for non-XLSX files classified as ESTIMATE
      if (record.classifiedType === "ESTIMATE") {
        const templateCheck = isLikelyTemplate(secondaryText);
        if (templateCheck.isTemplate) {
          record.classifiedType = "OTHER";
          record.classificationConfidence = 0.3;
          record.classificationReasoning = `Downgraded from ESTIMATE: ${templateCheck.reason}`;
          record.isTemplate = true;
        }
      }

      if ((record.classificationConfidence ?? 0) >= 0.6) {
        try {
          record.deliverableMetadata = await aiLimiter.execute(() =>
            extractDeliverables(secondaryText, record.classifiedType!)
          );
        } catch {
          // Non-fatal — proceed without metadata
        }
        // Update filesMetadata type if AI confidence is high enough
        fileMeta.type = record.classifiedType as typeof fileMeta.type;
      }
    }

    // Sync record type with (possibly updated) fileMeta type
    record.type = fileMeta.type;

    // For FINANCIAL, ESTIMATE, or PROPOSAL files, run secondary inference — rate-limited.
    // PROPOSAL included because technical proposals often carry the final commercial figure inline.
    if (extractedOk && secondaryText.length >= 100 && !xlsxSkipAiClassify && (fileMeta.type === "FINANCIAL" || fileMeta.type === "ESTIMATE" || fileMeta.type === "PROPOSAL")) {
      try {
        const secondaryInferred = await aiLimiter.execute(() =>
          inferFromSecondaryDocument(
            secondaryText,
            fileMeta.type as "ESTIMATE" | "FINANCIAL" | "PROPOSAL"
          )
        );
        // Budget must come only from TOR/RFP docs (primary inference), never from our financial proposal
        record.inferredBudget = fileMeta.type === "ESTIMATE" ? secondaryInferred.estimatedBudget : null;
        record.inferredTimeline = secondaryInferred.deliveryTimeline;
        record.inferredFinalCost = secondaryInferred.finalCostSubmitted;

        // Merge — only accept budget from ESTIMATE docs, not FINANCIAL/PROPOSAL (our bid)
        if (fileMeta.type === "ESTIMATE" && secondaryInferred.estimatedBudget != null) mergedEstimatedBudget = secondaryInferred.estimatedBudget;
        if (secondaryInferred.deliveryTimeline != null) mergedDeliveryTimeline = secondaryInferred.deliveryTimeline;
        // Final cost precedence: FINANCIAL always wins; otherwise first non-null wins (ESTIMATE or PROPOSAL).
        if (secondaryInferred.finalCostSubmitted != null && (fileMeta.type === "FINANCIAL" || mergedFinalCost == null)) {
          mergedFinalCost = secondaryInferred.finalCostSubmitted;
        }
      } catch (inferErr) {
        console.warn(
          `[import-worker] Secondary inference failed for ${fileMeta.fullPath}: ${inferErr instanceof Error ? inferErr.message : String(inferErr)}`
        );
      }
    }

    // Polish raw extracted text into clean markdown for downstream display.
    // Runs in the worker (background) so the interactive confirm endpoint
    // isn't blocked by chunked Sonnet calls for long RFP docs.
    if (
      extractedOk &&
      secondaryText.length >= 200 &&
      (record.classifiedType === "PROPOSAL" ||
        record.classifiedType === "TOR" ||
        record.classifiedType === "FINANCIAL")
    ) {
      try {
        record.contentMd = await aiLimiter.execute(() =>
          convertToMarkdown(secondaryText, record.classifiedType!, fileMeta.name)
        );
      } catch (mdErr) {
        console.warn(
          `[import-worker] Markdown conversion failed for ${fileMeta.fullPath}: ${mdErr instanceof Error ? mdErr.message : String(mdErr)}`
        );
      }
    }

    processedFileRecords.push(record);
  }

  // Match account using pre-loaded cache
  let matchedAccountId: string | null = null;
  if (inferred?.clientName) {
    matchedAccountId = findMatchingAccountFromCache(inferred.clientName, accounts);
  }

  // Create ImportItem with full metadata including processedFiles
  await prisma.importItem.create({
    data: {
      importJobId,
      folderName: folderName === "__root__" ? "Root files" : folderName,
      files: filesMetadata,
      primaryFileName,
      inferredClient: inferred?.clientName ?? null,
      inferredIndustry: inferred?.industry ?? null,
      inferredTechStack: inferred?.techStack ?? null,
      inferredEngagementType: inferred?.engagementType ?? null,
      inferredProjectName: inferred?.projectName ?? null,
      inferredSubmissionDeadline: inferred?.submissionDeadline
        ? new Date(inferred.submissionDeadline)
        : null,
      inferredIssueDate: inferred?.issueDate
        ? new Date(inferred.issueDate)
        : null,
      inferredDealValue: inferred?.estimatedDealValue ?? null,
      inferredFinancialValue: mergedFinalCost ?? inferred?.financialProposalValue ?? null,
      confidence: inferred?.confidence ?? undefined,
      extractedTextPreview: extractedText.slice(0, 500) || null,
      processedFiles: JSON.parse(JSON.stringify(processedFileRecords)),
      matchedAccountId,
      status: extractedText.length < 100 ? "FAILED" : "PENDING_REVIEW",
      errorMessage:
        extractedText.length < 100
          ? "Insufficient text extracted — manual review needed"
          : null,
    },
  });
}

/**
 * Compute average confidence score for an ImportItem.
 * Returns null if confidence data is not available.
 */
function averageConfidence(confidence: unknown): number | null {
  if (!confidence || typeof confidence !== "object") return null;
  const values = Object.values(confidence as Record<string, unknown>)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Auto-confirm a single ImportItem: creates engagement, phases, artefacts.
 * Uses the same logic as the per-item confirm API route.
 */
async function autoConfirmItem(
  item: {
    id: string;
    importJobId: string;
    folderName: string;
    files: unknown;
    inferredClient: string | null;
    inferredProjectName: string | null;
    inferredTechStack: string | null;
    inferredEngagementType: string | null;
    inferredIndustry: string | null;
    inferredDealValue: number | null;
    inferredFinancialValue: number | null;
    inferredSubmissionDeadline: Date | null;
    inferredIssueDate: Date | null;
    matchedAccountId: string | null;
    processedFiles: unknown;
  },
  systemUserId: string
): Promise<string> {
  interface FileEntry {
    name: string;
    fullPath: string;
    type: string;
    isPrimary: boolean;
    sizeBytes: number;
    isSubmission?: boolean;
  }

  const allFiles = item.files as unknown as FileEntry[];
  const clientName = item.inferredClient || item.folderName;
  const projectName = item.inferredProjectName || item.folderName;
  const techStack = item.inferredTechStack || "DRUPAL";
  const engagementType = item.inferredEngagementType || "NEW_BUILD";

  // Resolve account
  let finalAccountId = item.matchedAccountId;
  if (!finalAccountId && clientName) {
    const existing = await prisma.account.findFirst({
      where: { canonicalName: { equals: clientName, mode: "insensitive" } },
    });
    if (existing) {
      finalAccountId = existing.id;
    } else {
      const newAccount = await prisma.account.create({
        data: {
          canonicalName: clientName,
          industry: (item.inferredIndustry as "OTHER") ?? "OTHER",
        },
      });
      finalAccountId = newAccount.id;
    }
  }

  const hasEstimate = allFiles.some((f) => f.type === "ESTIMATE");
  const hasProposal = allFiles.some((f) => f.type === "PROPOSAL");
  const hasFinancial = allFiles.some((f) => f.type === "FINANCIAL");
  const hasAddendum = allFiles.some((f) => f.type === "ADDENDUM");
  const hasQaResponse = allFiles.some((f) => f.type === "QA_RESPONSE");
  const hasTorOrQuestions = allFiles.some((f) => ["TOR", "QUESTIONS"].includes(f.type));

  // Determine workflow path: HAS_RESPONSE if customer responded (QA or addendum)
  const workflowPath = (hasQaResponse || hasAddendum) ? "HAS_RESPONSE" : "NO_RESPONSE";

  // Create all 7 phases (same as regular engagement) with APPROVED/SKIPPED status
  const docPhaseMapping: Record<string, string[]> = {
    "0": ["RESEARCH"],
    "1": ["TOR", "QUESTIONS", "ANNEXURE", "PREREQUISITES", "RESPONSE_FORMAT"],
    "1A": workflowPath === "NO_RESPONSE" ? ["ESTIMATE"] : [],
    "2": ["QA_RESPONSE", "ADDENDUM"],
    "3": workflowPath === "HAS_RESPONSE" ? ["ESTIMATE"] : [],
    "4": [],
    "5": ["PROPOSAL", "FINANCIAL"],
  };

  const ALL_PHASES = ["0", "1", "1A", "2", "3", "4", "5"] as const;
  const phasesToCreate = ALL_PHASES.map((phaseNumber) => {
    const relevantTypes = docPhaseMapping[phaseNumber] || [];
    const hasDocs = relevantTypes.length > 0 && allFiles.some((f) => relevantTypes.includes(f.type));
    return { phaseNumber, status: (hasDocs ? "APPROVED" : "SKIPPED") as "APPROVED" | "SKIPPED" };
  });

  // Ensure Phase 0 is always APPROVED
  const phase0 = phasesToCreate.find((p) => p.phaseNumber === "0");
  if (phase0) phase0.status = "APPROVED";
  // Phase 1 needs APPROVED if TOR or questions exist
  const phase1 = phasesToCreate.find((p) => p.phaseNumber === "1");
  if (phase1 && hasTorOrQuestions) phase1.status = "APPROVED";

  type ProcessedFileRecord = {
    name: string;
    fullPath: string;
    type: string;
    isSubmission: boolean;
    extractedText: boolean;
    artefactCreated: boolean;
    inferredBudget?: number | null;
    inferredTimeline?: string | null;
    inferredFinalCost?: number | null;
  };
  const processedFilesArr = (item.processedFiles ?? []) as ProcessedFileRecord[];

  let estimatedBudget: number | null = null;
  let deliveryTimeline: string | null = null;
  for (const pf of processedFilesArr) {
    if (pf.inferredBudget != null) estimatedBudget = pf.inferredBudget;
    if (pf.inferredTimeline != null) deliveryTimeline = pf.inferredTimeline;
  }

  const engagement = await prisma.engagement.create({
    data: {
      clientName,
      projectName,
      techStack: techStack as "DRUPAL",
      engagementType: engagementType as "NEW_BUILD",
      status: "COMPLETED",
      workflowPath: workflowPath as "HAS_RESPONSE" | "NO_RESPONSE",
      accountId: finalAccountId,
      createdById: systemUserId,
      importSource: "ZIP_IMPORT",
      importFilePath: item.folderName,
      importedAt: new Date(),
      estimatedDealValue: item.inferredDealValue,
      financialProposalValue: item.inferredFinancialValue,
      submissionDeadline: item.inferredSubmissionDeadline,
      estimatedBudget,
      deliveryTimeline,
      rfpIssuedAt: item.inferredIssueDate ?? null,
      phases: {
        create: phasesToCreate,
      },
    },
    include: { phases: true },
  });

  const phaseMap = new Map(engagement.phases.map((p) => [p.phaseNumber, p.id]));

  function getMimeType(fileName: string): string {
    return fileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  function getS3Subfolder(fileType: string, isSubmission: boolean): string {
    if (isSubmission) return "submissions";
    switch (fileType) {
      case "TOR": return "tor";
      case "ANNEXURE": return "tor";
      case "PREREQUISITES": return "tor";
      case "RESPONSE_FORMAT": return "tor";
      case "QUESTIONS": return "initial_questions";
      case "QA_RESPONSE": return "responses_qna";
      case "ADDENDUM": return "responses_qna";
      case "ESTIMATE": return "estimates";
      case "RESEARCH": return "claude-artefacts";
      case "PROPOSAL": return "claude-artefacts";
      case "FINANCIAL": return "claude-artefacts";
      default: return "tor";
    }
  }

  function getArtefactConfig(fileType: string): { phaseNumber: string; artefactType: ArtefactType; label: string } | null {
    switch (fileType) {
      case "TOR":
        return { phaseNumber: "1", artefactType: ArtefactType.TOR_ASSESSMENT, label: "Imported TOR Assessment" };
      case "QUESTIONS":
        return { phaseNumber: "1", artefactType: ArtefactType.QUESTIONS, label: "Imported Questions" };
      case "ANNEXURE":
        return { phaseNumber: "1", artefactType: ArtefactType.TOR_ASSESSMENT, label: "Imported Annexure" };
      case "PREREQUISITES":
        return { phaseNumber: "1", artefactType: ArtefactType.TOR_ASSESSMENT, label: "Imported Prerequisites" };
      case "RESPONSE_FORMAT":
        return { phaseNumber: "1", artefactType: ArtefactType.TOR_ASSESSMENT, label: "Imported Response Format" };
      case "RESEARCH":
        return { phaseNumber: "0", artefactType: ArtefactType.RESEARCH, label: "Imported Research" };
      case "QA_RESPONSE":
        return { phaseNumber: "2", artefactType: ArtefactType.RESPONSE_ANALYSIS, label: "Imported Q&A Response" };
      case "ADDENDUM":
        return { phaseNumber: "2", artefactType: ArtefactType.RESPONSE_ANALYSIS, label: "Imported Addendum" };
      case "ESTIMATE":
        return { phaseNumber: workflowPath === "HAS_RESPONSE" ? "3" : "1A", artefactType: ArtefactType.ESTIMATE, label: "Imported Estimate" };
      case "FINANCIAL":
        return { phaseNumber: "5", artefactType: ArtefactType.PROPOSAL, label: "Imported Financial Proposal" };
      case "PROPOSAL":
        return { phaseNumber: "5", artefactType: ArtefactType.PROPOSAL, label: "Imported Technical Proposal" };
      default:
        return null;
    }
  }

  try {
    const zipBuffer = await downloadFile(`imports/${item.importJobId}/upload.zip`);
    const zip = new AdmZip(zipBuffer);
    const artefactVersions = new Map<string, number>();

    for (const fileMeta of allFiles) {
      const entry = zip.getEntry(fileMeta.fullPath);
      if (!entry) continue;

      const fileBuffer = entry.getData();
      const artefactConfig = getArtefactConfig(fileMeta.type);
      const subfolder = getS3Subfolder(fileMeta.type, fileMeta.isSubmission ?? false);
      const mimeType = getMimeType(fileMeta.name);

      try {
        await uploadFile(
          `engagements/${engagement.id}/${subfolder}/${fileMeta.name}`,
          fileBuffer,
          mimeType
        );
      } catch (uploadErr) {
        console.warn(
          `[import-worker/auto-confirm] S3 upload failed for ${fileMeta.fullPath}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`
        );
      }

      if (artefactConfig) {
        const phaseId = phaseMap.get(artefactConfig.phaseNumber);
        if (phaseId) {
          try {
            let extractedText = "";
            if (fileMeta.name.toLowerCase().endsWith(".pdf")) {
              const result = await extractTextFromPdf(fileBuffer);
              extractedText = result.text;
            } else if (fileMeta.name.toLowerCase().endsWith(".docx")) {
              const result = await extractTextFromDocx(fileBuffer);
              extractedText = result.text;
            } else if (/\.xlsx?$/i.test(fileMeta.name)) {
              // XLSX files: generate markdown from worker-extracted data
              const pfRec = processedFilesArr.find((pf) => pf.fullPath === fileMeta.fullPath) as { deliverableMetadata?: { rawData?: unknown } } | undefined;
              if (pfRec?.deliverableMetadata?.rawData) {
                const { xlsxEstimateToMarkdown } = await import("@/lib/xlsx-estimate-reader");
                extractedText = xlsxEstimateToMarkdown(pfRec.deliverableMetadata.rawData as Parameters<typeof xlsxEstimateToMarkdown>[0]);
              }
            }

            if (extractedText) {
              const versionKey = `${phaseId}:${artefactConfig.artefactType}`;
              const version = (artefactVersions.get(versionKey) ?? 0) + 1;
              artefactVersions.set(versionKey, version);

              await prisma.phaseArtefact.create({
                data: {
                  phaseId,
                  artefactType: artefactConfig.artefactType,
                  version,
                  label: artefactConfig.label || `Imported: ${fileMeta.name}`,
                  contentMd: extractedText,
                  fileUrl: `engagements/${engagement.id}/${subfolder}/${fileMeta.name}`,
                },
              });
            }
          } catch (artefactErr) {
            console.warn(
              `[import-worker/auto-confirm] Artefact creation failed for ${fileMeta.fullPath}: ${artefactErr instanceof Error ? artefactErr.message : String(artefactErr)}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      `[import-worker/auto-confirm] File processing failed for engagement ${engagement.id}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await prisma.importItem.update({
    where: { id: item.id },
    data: {
      status: "CONFIRMED",
      engagementId: engagement.id,
      matchedAccountId: finalAccountId,
      reviewedAt: new Date(),
      reviewedBy: systemUserId,
    },
  });

  return engagement.id;
}

const worker = new Worker<ImportJobData>(
  "rfp-import",
  async (job) => {
    const { importJobId } = job.data;

    console.log(`[import-worker] Starting import job ${importJobId}`);

    const importJob = await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "PROCESSING" },
    });

    try {
      // Download ZIP from S3
      const s3Key = `imports/${importJobId}/upload.zip`;
      const zipBuffer = await downloadFile(s3Key);

      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      // Group files by folder
      const groups = groupEntriesByFolder(entries);
      const totalFolders = groups.size;

      await prisma.importJob.update({
        where: { id: importJobId },
        data: { totalFiles: totalFolders },
      });

      // Cache all accounts once at job start — avoids N per-folder DB queries
      const accounts = await prisma.account.findMany({
        select: { id: true, canonicalName: true, aliases: true },
      });

      // Step 7 (Resume): find folders already processed, skip them
      const existingItems = await prisma.importItem.findMany({
        where: { importJobId },
        select: { folderName: true },
      });
      const processedFolderNames = new Set(
        existingItems.map((item) =>
          item.folderName === "Root files" ? "__root__" : item.folderName
        )
      );

      // Filter to only unprocessed folders
      const folders = Array.from(groups.entries()).filter(
        ([folderName]) => !processedFolderNames.has(folderName)
      );

      let processedCount = existingItems.length; // start from already-done count

      // Shared index counter for the semaphore pattern
      let index = 0;
      const indexLock = { value: 0 };

      async function processNext(): Promise<void> {
        while (true) {
          // Claim the next folder index atomically
          const current = indexLock.value++;
          if (current >= folders.length) break;

          const [folderName, folderEntries] = folders[current];

          // Step 7 (Pause): check job status before processing each folder
          const jobStatus = await prisma.importJob.findUnique({
            where: { id: importJobId },
            select: { status: true },
          });
          if (jobStatus?.status === "PAUSED") {
            console.log(`[import-worker] Job ${importJobId} paused — stopping`);
            return;
          }

          try {
            await processOneFolder(folderName, folderEntries, importJobId, accounts);
            processedCount++;
            await prisma.importJob.update({
              where: { id: importJobId },
              data: { processedFiles: processedCount },
            });

            await job.updateProgress({
              processed: processedCount,
              total: totalFolders,
              currentFolder: folderName,
            });
          } catch (folderErr) {
            console.error(
              `[import-worker] Error processing folder ${folderName}: ${folderErr instanceof Error ? folderErr.message : String(folderErr)}`
            );
            // Create a failed item so admin can see it
            await prisma.importItem.create({
              data: {
                importJobId,
                folderName: folderName === "__root__" ? "Root files" : folderName,
                files: [],
                status: "FAILED",
                errorMessage: folderErr instanceof Error ? folderErr.message : String(folderErr),
              },
            });
            processedCount++;
            await prisma.importJob.update({
              where: { id: importJobId },
              data: { processedFiles: processedCount },
            });
          }
        }
      }

      // Launch FOLDER_CONCURRENCY parallel workers
      await Promise.all(
        Array.from({ length: FOLDER_CONCURRENCY }, () => processNext())
      );

      // Check if job was paused mid-way — exit without moving to REVIEW
      const finalJobStatus = await prisma.importJob.findUnique({
        where: { id: importJobId },
        select: { status: true },
      });
      if (finalJobStatus?.status === "PAUSED") {
        console.log(`[import-worker] Job ${importJobId} paused cleanly after processing ${processedCount} folders`);
        return;
      }

      // Step 4 (Auto-confirm): confirm qualifying items if threshold is set
      const autoConfirmThreshold = importJob.autoConfirmThreshold;
      if (autoConfirmThreshold != null) {
        console.log(`[import-worker] Auto-confirm threshold: ${autoConfirmThreshold}`);

        const pendingItems = await prisma.importItem.findMany({
          where: { importJobId, status: "PENDING_REVIEW" },
        });

        // Get the job's userId to use as the system user for auto-confirms
        const jobRecord = await prisma.importJob.findUnique({
          where: { id: importJobId },
          select: { userId: true },
        });
        const systemUserId = jobRecord?.userId ?? "";

        const accuracyFloor = getAutoConfirmMinAccuracyScore();
        let autoConfirmedCount = 0;
        for (const item of pendingItems) {
          const avgConf = averageConfidence(item.confidence);
          if (avgConf != null && avgConf >= autoConfirmThreshold) {
            let createdEngagementId: string | null = null;
            try {
              createdEngagementId = await autoConfirmItem(item, systemUserId);

              // Accuracy gate: if any ValidationReport rows exist for the
              // newly-created engagement and the weighted score is below
              // AUTO_CONFIRM_MIN_ACCURACY_SCORE, revert the auto-confirm and
              // force manual review. No reports = no gating signal, proceed.
              const accuracy = await getOverallAccuracyForEngagement(createdEngagementId);
              if (accuracy != null && accuracy.score < accuracyFloor) {
                await prisma.engagement.delete({ where: { id: createdEngagementId } });
                await prisma.importItem.update({
                  where: { id: item.id },
                  data: {
                    status: "PENDING_REVIEW",
                    engagementId: null,
                    reviewedAt: null,
                    reviewedBy: null,
                    errorMessage: "Below accuracy threshold — manual review required",
                  },
                });
                console.log(
                  `[import-worker] Auto-confirm gated for item ${item.id}: accuracy ${accuracy.score.toFixed(3)} < ${accuracyFloor}`
                );
                continue;
              }

              autoConfirmedCount++;
            } catch (confirmErr) {
              console.warn(
                `[import-worker] Auto-confirm failed for item ${item.id}: ${confirmErr instanceof Error ? confirmErr.message : String(confirmErr)}`
              );
            }
          }
        }

        if (autoConfirmedCount > 0) {
          await prisma.importJob.update({
            where: { id: importJobId },
            data: { confirmedFiles: { increment: autoConfirmedCount } },
          });
          console.log(`[import-worker] Auto-confirmed ${autoConfirmedCount} items for job ${importJobId}`);
        }
      }

      // All folders processed — move to REVIEW
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: "REVIEW" },
      });

      console.log(`[import-worker] Import job ${importJobId} complete — ${processedCount} folders processed`);
    } catch (err) {
      console.error(
        `[import-worker] Import job ${importJobId} failed: ${err instanceof Error ? err.message : String(err)}`
      );
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  },
  {
    concurrency: 1,
    connection: redisConnection,
  }
);

export default worker;
