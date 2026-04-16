/**
 * POST /api/imports/[id]/items/[itemId]/confirm
 * Confirm an import item — creates an ARCHIVED engagement linked to the account.
 * Accepts optional body to override inferred metadata.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { uploadFile, downloadFile } from "@/lib/storage";
import { ArtefactType } from "@/generated/prisma/client";
import AdmZip from "adm-zip";
import { extractTextFromPdf } from "@/lib/pdf-extractor";
import { extractTextFromDocx } from "@/lib/docx-extractor";
import { copyMasterTemplate } from "@/lib/template-populator";
import { extractAssumptions, extractRiskRegister } from "@/lib/ai/metadata-extractor";
import ExcelJS from "exceljs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id: importJobId, itemId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const item = await prisma.importItem.findFirst({
    where: { id: itemId, importJobId },
  });

  if (!item) {
    return NextResponse.json({ error: "Import item not found" }, { status: 404 });
  }

  if (item.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Item already confirmed", engagementId: item.engagementId },
      { status: 409 }
    );
  }

  // Allow overrides from request body
  const clientName = (body.clientName as string) || item.inferredClient || item.folderName;
  const projectName = (body.projectName as string) || item.inferredProjectName || item.folderName;
  const techStack = (body.techStack as string) || item.inferredTechStack || "DRUPAL";
  const engagementType = (body.engagementType as string) || item.inferredEngagementType || "NEW_BUILD";
  const accountId = (body.accountId as string) || item.matchedAccountId || null;
  const bodyEstimatedBudget = body.estimatedBudget != null ? Number(body.estimatedBudget) : null;
  const bodyDeliveryTimeline = (body.deliveryTimeline as string) || null;
  const bodyFinalCost = body.finalCostSubmitted != null ? Number(body.finalCostSubmitted) : null;

  // Create or find account
  let finalAccountId = accountId;
  if (!finalAccountId && clientName) {
    // Create a new account for this client
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

  // Determine which phases to create based on file types in the folder
  interface FileEntry {
    name: string;
    fullPath: string;
    type: string;
    isPrimary: boolean;
    sizeBytes: number;
    isSubmission?: boolean;
  }

  const allFiles = item.files as unknown as FileEntry[];

  // Helper: get the effective document type, preferring AI classification when confident
  function getEffectiveType(file: FileEntry): string {
    const pfRecord = (item!.processedFiles as ProcessedFileRecord[] ?? []).find(
      (pf) => pf.fullPath === file.fullPath
    );
    const aiType =
      pfRecord?.classificationConfidence != null && pfRecord.classificationConfidence >= 0.6
        ? pfRecord.classifiedType
        : undefined;
    return aiType ?? file.type;
  }

  const hasEstimate = allFiles.some((f) => getEffectiveType(f) === "ESTIMATE");
  const hasProposal = allFiles.some((f) => getEffectiveType(f) === "PROPOSAL");
  const hasFinancial = allFiles.some((f) => getEffectiveType(f) === "FINANCIAL");
  const hasAddendum = allFiles.some((f) => getEffectiveType(f) === "ADDENDUM");
  const hasQaResponse = allFiles.some((f) => getEffectiveType(f) === "QA_RESPONSE");
  const hasTorOrQuestions = allFiles.some((f) => ["TOR", "QUESTIONS"].includes(getEffectiveType(f)));
  const hasPrereqs = allFiles.some((f) => getEffectiveType(f) === "PREREQUISITES");
  const hasResponseFormat = allFiles.some((f) => getEffectiveType(f) === "RESPONSE_FORMAT");
  const hasResearch = allFiles.some((f) => getEffectiveType(f) === "RESEARCH");

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
    const hasDocs = relevantTypes.length > 0 && allFiles.some((f) => relevantTypes.includes(getEffectiveType(f)));
    return { phaseNumber, status: (hasDocs ? "APPROVED" : "SKIPPED") as "APPROVED" | "SKIPPED" };
  });

  // Ensure Phase 0 is always APPROVED (even without explicit RESEARCH docs, TOR is uploaded there)
  const phase0 = phasesToCreate.find((p) => p.phaseNumber === "0");
  if (phase0) phase0.status = "APPROVED";
  // Phase 1 needs APPROVED if TOR, questions, or supplementary docs exist
  const phase1 = phasesToCreate.find((p) => p.phaseNumber === "1");
  if (phase1 && (hasTorOrQuestions || hasPrereqs || hasResponseFormat)) phase1.status = "APPROVED";

  // Extract issueDate / estimatedBudget / deliveryTimeline from item metadata
  // processedFiles carries secondary inference results and AI classification data
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
    classifiedType?: string;
    classificationConfidence?: number;
    classificationReasoning?: string;
    deliverableMetadata?: Record<string, unknown> | null;
    combinedMetadata?: { technical: Record<string, unknown> | null; financial: Record<string, unknown> | null } | null;
  };
  const processedFiles = (item.processedFiles ?? []) as ProcessedFileRecord[];

  // Merge budget/timeline from secondary docs; body overrides win
  let estimatedBudget: number | null = null;
  let deliveryTimeline: string | null = null;
  for (const pf of processedFiles) {
    if (pf.inferredBudget != null) estimatedBudget = pf.inferredBudget;
    if (pf.inferredTimeline != null) deliveryTimeline = pf.inferredTimeline;
  }
  if (bodyEstimatedBudget != null) estimatedBudget = bodyEstimatedBudget;
  if (bodyDeliveryTimeline != null) deliveryTimeline = bodyDeliveryTimeline;

  // Create the ARCHIVED engagement with multiple phases
  const engagement = await prisma.engagement.create({
    data: {
      clientName,
      projectName,
      techStack: techStack as "DRUPAL",
      engagementType: engagementType as "NEW_BUILD",
      status: "COMPLETED",
      workflowPath: workflowPath as "HAS_RESPONSE" | "NO_RESPONSE",
      accountId: finalAccountId,
      createdById: session.user.id,
      importSource: "ZIP_IMPORT",
      importFilePath: item.folderName,
      importedAt: new Date(),
      estimatedDealValue: item.inferredDealValue,
      financialProposalValue: bodyFinalCost ?? item.inferredFinancialValue,
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

  // Build a map from phaseNumber to phase id
  const phaseMap = new Map(engagement.phases.map((p) => [p.phaseNumber, p.id]));

  // 4C: Populate Master Estimate Template from XLSX data if available
  const xlsxEstimateFile = processedFiles.find(
    (pf) => pf.classifiedType === "ESTIMATE" && pf.deliverableMetadata?.rawData
  );

  if (xlsxEstimateFile) {
    try {
      const templateKey = await copyMasterTemplate(engagement.id);
      const templateBuffer = await downloadFile(templateKey);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer as ArrayBuffer);

      type EstimateRow = {
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
      };

      const rawData = xlsxEstimateFile.deliverableMetadata!.rawData as {
        backend: EstimateRow[];
        frontend: EstimateRow[];
        fixedCost: EstimateRow[];
        design: EstimateRow[];
        ai: EstimateRow[];
      };

      const XLSX_DATA_START_ROW = 7;

      const tabConfigs = [
        { name: "Backend", data: rawData.backend, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
        { name: "Frontend", data: rawData.frontend, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
        { name: "Fixed Cost Items", data: rawData.fixedCost, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 11, extra: -1, links: 13 } },
        { name: "Design", data: rawData.design ?? [], cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
        { name: "AI", data: rawData.ai, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
      ];

      const tabStatus: Record<string, boolean> = {};

      for (const tab of tabConfigs) {
        const sheet = workbook.getWorksheet(tab.name);
        const statusKey = tab.name === "Fixed Cost Items" ? "fixedCost" : tab.name.toLowerCase();
        if (!sheet || tab.data.length === 0) {
          tabStatus[statusKey] = false;
          continue;
        }

        let rowIdx = XLSX_DATA_START_ROW;
        let currentDomain = "";

        for (const row of tab.data) {
          if (row.domain && row.domain !== currentDomain) {
            currentDomain = row.domain;
            sheet.getCell(rowIdx, tab.cols.task).value = currentDomain;
            sheet.getCell(rowIdx, tab.cols.task).font = { bold: true };
            rowIdx++;
          }

          sheet.getCell(rowIdx, tab.cols.task).value = row.task;
          sheet.getCell(rowIdx, tab.cols.desc).value = row.description;
          sheet.getCell(rowIdx, tab.cols.hrs).value = row.hours;
          sheet.getCell(rowIdx, tab.cols.conf).value = row.conf;
          sheet.getCell(rowIdx, tab.cols.low).value = row.lowHrs;
          sheet.getCell(rowIdx, tab.cols.high).value = row.highHrs;
          sheet.getCell(rowIdx, tab.cols.assumptions).value = row.assumptions;
          if (tab.cols.extra > 0) {
            sheet.getCell(rowIdx, tab.cols.extra).value = row.solutionOrExclusions;
          }
          if (tab.cols.links > 0) {
            sheet.getCell(rowIdx, tab.cols.links).value = row.links;
          }

          for (const col of Object.values(tab.cols)) {
            if (col > 0) {
              sheet.getCell(rowIdx, col).alignment = { wrapText: true, vertical: "top" };
            }
          }
          rowIdx++;
        }

        tabStatus[statusKey] = true;
      }

      const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      await uploadFile(templateKey, outputBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      await prisma.engagement.update({
        where: { id: engagement.id },
        data: {
          templateFileUrl: templateKey,
          templateStatus: JSON.parse(JSON.stringify(tabStatus)),
        },
      });

      // Persist LineItem rows mirroring the XLSX traversal above.
      // Imported estimates lack TOR traceability, so every row carries a
      // standard orphanJustification instead of a TorRequirement link. This
      // keeps accuracy reporting coherent without blocking imports.
      try {
        const tabEnumMap: Record<string, string> = {
          Backend: "BACKEND",
          Frontend: "FRONTEND",
          "Fixed Cost Items": "FIXED_COST",
          Design: "DESIGN",
          AI: "AI",
        };
        const estPhaseIdForItems =
          phaseMap.get(workflowPath === "NO_RESPONSE" ? "1A" : "3") ??
          engagement.phases[0]?.id ??
          null;
        const tierRegex = /\b(T1|T2|T3)\b/i;
        const orphanJustification =
          "Imported from external XLSX; TOR requirement mapping not captured at import time.";

        const lineItemPayload: Array<{
          engagementId: string;
          tab: string;
          task: string;
          description: string;
          hours: number;
          conf: number;
          lowHrs: number;
          highHrs: number;
          benchmarkRef: null;
          integrationTier: string | null;
          orphanJustification: string;
          sourcePhaseId: string | null;
        }> = [];

        for (const tab of tabConfigs) {
          const tabEnum = tabEnumMap[tab.name];
          if (!tabEnum || !tab.data || tab.data.length === 0) continue;
          for (const row of tab.data) {
            const tierMatch = row.description?.match(tierRegex);
            lineItemPayload.push({
              engagementId: engagement.id,
              tab: tabEnum,
              task: row.task ?? "",
              description: row.description ?? "",
              hours: Number(row.hours) || 0,
              conf: Number(row.conf) || 0,
              lowHrs: Number(row.lowHrs) || 0,
              highHrs: Number(row.highHrs) || 0,
              benchmarkRef: null,
              integrationTier: tierMatch ? tierMatch[1].toUpperCase() : null,
              orphanJustification,
              sourcePhaseId: estPhaseIdForItems,
            });
          }
        }

        if (lineItemPayload.length > 0) {
          await prisma.lineItem.createMany({
            data: lineItemPayload,
            skipDuplicates: true,
          });
        }
      } catch (err) {
        console.warn(
          `[import-confirm] LineItem persistence failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } catch (err) {
      console.warn(`[import-confirm] Failed to populate estimate template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Add "AI" tag if XLSX estimate has an AI tab with data
  // Also extract assumptions from XLSX estimate rows
  if (xlsxEstimateFile) {
    const rawDataForTags = xlsxEstimateFile.deliverableMetadata?.rawData as {
      ai?: Array<{ assumptions?: string }>;
      backend?: Array<{ assumptions?: string; task?: string }>;
      frontend?: Array<{ assumptions?: string; task?: string }>;
      fixedCost?: Array<{ assumptions?: string; task?: string }>;
      design?: Array<{ assumptions?: string; task?: string }>;
    } | undefined;

    if (rawDataForTags?.ai && Array.isArray(rawDataForTags.ai) && rawDataForTags.ai.length > 0) {
      await prisma.engagement.update({
        where: { id: engagement.id },
        data: { tags: ["AI"] },
      });
    }

    // Compile assumptions from all XLSX tabs
    try {
      const estPhaseId = phaseMap.get(workflowPath === "HAS_RESPONSE" ? "3" : "1A") ?? engagement.phases[0]?.id ?? "";
      const tabNames = ["backend", "frontend", "fixedCost", "design", "ai"] as const;
      const xlsxAssumptions: Array<{ text: string; torReference: string | null; impactIfWrong: string }> = [];

      for (const tab of tabNames) {
        const rows = (rawDataForTags as Record<string, Array<{ task?: string; assumptions?: string }>> | undefined)?.[tab];
        if (!rows || !Array.isArray(rows)) continue;
        for (const row of rows) {
          if (row.assumptions && row.assumptions.trim()) {
            xlsxAssumptions.push({
              text: row.assumptions.trim(),
              torReference: null,
              impactIfWrong: `Affects ${tab} task: ${row.task ?? "unknown"}`,
            });
          }
        }
      }

      if (xlsxAssumptions.length > 0 && estPhaseId) {
        await prisma.assumption.createMany({
          data: xlsxAssumptions.map((a) => ({
            engagementId: engagement.id,
            sourcePhaseId: estPhaseId,
            text: a.text,
            torReference: a.torReference,
            impactIfWrong: a.impactIfWrong,
          })),
        });
      }
    } catch (err) {
      console.warn(`[import-confirm] XLSX assumptions extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Template population for non-XLSX imports (mirrors regular engagement workflow)
  if (!xlsxEstimateFile) {
    try {
      const hasTorArtefact = allFiles.some((f) => getEffectiveType(f) === "TOR");
      if (hasTorArtefact) {
        const { populateTemplateAfterPhase1 } = await import("@/lib/template-populator");
        await populateTemplateAfterPhase1(engagement.id);
      }

      if (hasEstimate) {
        const { populateTemplateAfterEstimate } = await import("@/lib/template-populator");
        const estPhase = workflowPath === "HAS_RESPONSE" ? "3" : "1A";
        await populateTemplateAfterEstimate(engagement.id, estPhase);
      }
    } catch (err) {
      console.warn(`[import-confirm] Template population failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4D: Prefer submission folder files for financial metadata
  // Check both AI classifiedType and static file type (AI may have failed)
  // Prefer versioned files (v2, v2.0, etc.) over unversioned ones
  {
    const submissionFinancials = processedFiles.filter(
      (pf) => pf.isSubmission && (pf.classifiedType === "FINANCIAL" || pf.type === "FINANCIAL")
    );
    // Sort: versioned files first (higher version wins), then by name
    const versionRegex = /v(\d+(?:\.\d+)?)/i;
    submissionFinancials.sort((a, b) => {
      const aMatch = a.name.match(versionRegex);
      const bMatch = b.name.match(versionRegex);
      const aVer = aMatch ? parseFloat(aMatch[1]) : 0;
      const bVer = bMatch ? parseFloat(bMatch[1]) : 0;
      return bVer - aVer; // Higher version first
    });
    const bestFinancial = submissionFinancials[0];
    if (bestFinancial?.deliverableMetadata) {
      const meta = bestFinancial.deliverableMetadata as { totalCost?: number };
      if (meta.totalCost) {
        await prisma.engagement.update({
          where: { id: engagement.id },
          data: { financialProposalValue: meta.totalCost },
        });
      }
    }
  }

  // Helper: get MIME type
  function getMimeType(fileName: string): string {
    return fileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // Helper: get S3 subfolder by file type (matches regular engagement folder structure)
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

  // Helper: map file type to artefact type and phase
  // Matches the structure of regular (manually-run) engagements
  function getArtefactConfig(fileType: string, aiClassifiedType?: string): { phaseNumber: string; artefactType: ArtefactType; label: string } | null {
    const effectiveType = aiClassifiedType ?? fileType;
    switch (effectiveType) {
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

  // Workstream C: Build superseded set — standard files superseded by submission counterparts
  const supersededPaths = new Set<string>();
  {
    // Group files by effective type
    const byType = new Map<string, { submission: FileEntry[]; standard: FileEntry[] }>();
    for (const f of allFiles) {
      const effectiveType = getEffectiveType(f);
      if (!byType.has(effectiveType)) byType.set(effectiveType, { submission: [], standard: [] });
      const group = byType.get(effectiveType)!;
      if (f.isSubmission) {
        group.submission.push(f);
      } else {
        group.standard.push(f);
      }
    }
    // Mark standard files as superseded when a submission counterpart exists
    for (const [, group] of byType) {
      if (group.submission.length > 0 && group.standard.length > 0) {
        for (const std of group.standard) {
          supersededPaths.add(std.fullPath);
        }
      }
    }
  }

  // Process all files: extract text, create artefacts, upload to S3
  try {
    const zipBuffer = await downloadFile(`imports/${importJobId}/upload.zip`);
    const zip = new AdmZip(zipBuffer);

    // Track artefact versions per (phaseId, artefactType)
    const artefactVersions = new Map<string, number>();

    for (const fileMeta of allFiles) {
      const entry = zip.getEntry(fileMeta.fullPath);
      if (!entry) continue;

      const fileBuffer = entry.getData();

      // Look up AI classification data from processedFiles
      const pfRecord = processedFiles.find((pf) => pf.fullPath === fileMeta.fullPath);
      const aiClassifiedType =
        pfRecord?.classificationConfidence != null && pfRecord.classificationConfidence >= 0.6
          ? pfRecord.classifiedType
          : undefined;

      const artefactConfig = getArtefactConfig(fileMeta.type, aiClassifiedType);
      const effectiveType = aiClassifiedType ?? fileMeta.type;
      const subfolder = getS3Subfolder(effectiveType, fileMeta.isSubmission ?? false);
      const mimeType = getMimeType(fileMeta.name);

      // Upload file to S3
      try {
        await uploadFile(
          `engagements/${engagement.id}/${subfolder}/${fileMeta.name}`,
          fileBuffer,
          mimeType
        );
      } catch (uploadErr) {
        console.warn(
          `[import-confirm] S3 upload failed for ${fileMeta.fullPath}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`
        );
      }

      // Skip artefact creation for superseded files (Workstream C)
      const isSuperseded = supersededPaths.has(fileMeta.fullPath);

      // Create artefact if we have a matching phase and file is not superseded
      if (artefactConfig && !isSuperseded) {
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
            } else if (/\.xlsx?$/i.test(fileMeta.name) && pfRecord?.deliverableMetadata?.rawData) {
              // XLSX files: generate markdown from worker-extracted rawData
              const { xlsxEstimateToMarkdown } = await import("@/lib/xlsx-estimate-reader");
              extractedText = xlsxEstimateToMarkdown(pfRecord.deliverableMetadata.rawData as Parameters<typeof xlsxEstimateToMarkdown>[0]);
            }

            if (extractedText) {
              const versionKey = `${phaseId}:${artefactConfig.artefactType}`;
              const version = (artefactVersions.get(versionKey) ?? 0) + 1;
              artefactVersions.set(versionKey, version);

              const artefactLabel = artefactConfig.label || `Imported: ${fileMeta.name}`;

              // Prefer the markdown polished by the import worker (pre-computed
              // during PENDING_REVIEW processing). Fall back to raw extracted
              // text if the worker didn't run conversion (e.g. older imports
              // or worker error).
              const contentMd =
                (pfRecord as { contentMd?: string | null } | undefined)?.contentMd ??
                extractedText;

              await prisma.phaseArtefact.create({
                data: {
                  phaseId,
                  artefactType: artefactConfig.artefactType,
                  version,
                  label: artefactLabel,
                  contentMd,
                  fileUrl: `engagements/${engagement.id}/${subfolder}/${fileMeta.name}`,
                  metadata: pfRecord?.deliverableMetadata
                    ? JSON.parse(JSON.stringify(pfRecord.deliverableMetadata))
                    : undefined,
                },
              });
            }
          } catch (artefactErr) {
            console.warn(
              `[import-confirm] Artefact creation failed for ${fileMeta.fullPath}: ${artefactErr instanceof Error ? artefactErr.message : String(artefactErr)}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      `[import-confirm] File processing failed for engagement ${engagement.id}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Handle combined proposals - create additional artefact for financial section
  try {
    for (const pf of processedFiles) {
      if (pf.combinedMetadata?.financial) {
        const phase1AId = phaseMap.get("1A") ?? null;
        if (phase1AId) {
          const artefactVersions2 = new Map<string, number>();
          const versionKey = `${phase1AId}:${ArtefactType.ESTIMATE_STATE}`;
          const version = (artefactVersions2.get(versionKey) ?? 0) + 1;
          artefactVersions2.set(versionKey, version);
          await prisma.phaseArtefact.create({
            data: {
              phaseId: phase1AId,
              artefactType: ArtefactType.ESTIMATE_STATE,
              version,
              label: "Financial Section (from combined proposal)",
              contentMd: "Extracted from combined technical/financial proposal",
              metadata: JSON.parse(JSON.stringify(pf.combinedMetadata.financial)),
            },
          });
          // Update financial value from combined metadata
          const finMeta = pf.combinedMetadata.financial as { totalCost?: number };
          if (finMeta?.totalCost) {
            await prisma.engagement.update({
              where: { id: engagement.id },
              data: { financialProposalValue: finMeta.totalCost },
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[import-confirm] Combined proposal processing failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Workstream E: Populate Assumptions and Risks from imported estimate data
  try {
    const estimateFiles = processedFiles.filter(
      (pf) => pf.classifiedType === "ESTIMATE" || pf.classifiedType === "FINANCIAL"
    );

    const phase1A = engagement.phases.find((p) => p.phaseNumber === "1A");
    const sourcePhaseId = phase1A?.id ?? engagement.phases[0]?.id ?? "";

    for (const estFile of estimateFiles) {
      const meta = estFile.deliverableMetadata as Record<string, unknown> | null;

      // Try AI-extracted assumptions/risks from deliverableMetadata first
      let assumptions: Array<{ text: string; torReference: string | null; impactIfWrong: string }> = [];
      let risks: Array<{ task: string; tab: string; conf: number; risk: string; openQuestion: string; recommendedAction: string; hoursAtRisk: number }> = [];

      if (meta?.assumptions && Array.isArray(meta.assumptions) && (meta.assumptions as unknown[]).length > 0) {
        assumptions = meta.assumptions as typeof assumptions;
      }
      if (meta?.risks && Array.isArray(meta.risks) && (meta.risks as unknown[]).length > 0) {
        risks = meta.risks as typeof risks;
      }

      // Fallback for PDF/DOCX: use markdown-based extractors if no AI-extracted data
      if (assumptions.length === 0 || risks.length === 0) {
        // Find the artefact content to parse markdown from
        const artefact = await prisma.phaseArtefact.findFirst({
          where: {
            phaseId: sourcePhaseId,
            artefactType: "ESTIMATE",
            label: { contains: estFile.name },
          },
          select: { contentMd: true },
        });

        if (artefact?.contentMd) {
          if (assumptions.length === 0) {
            assumptions = extractAssumptions(artefact.contentMd);
          }
          if (risks.length === 0) {
            risks = extractRiskRegister(artefact.contentMd);
          }
        }
      }

      // Create assumption records
      if (assumptions.length > 0) {
        await prisma.assumption.createMany({
          data: assumptions.map((a) => ({
            engagementId: engagement.id,
            sourcePhaseId,
            text: a.text,
            torReference: a.torReference ?? null,
            impactIfWrong: a.impactIfWrong || "Unknown",
          })),
        });
      }

      // Create risk register entries
      if (risks.length > 0) {
        await prisma.riskRegisterEntry.createMany({
          data: risks.map((r) => ({
            engagementId: engagement.id,
            task: r.task,
            tab: r.tab || "Backend",
            conf: r.conf || 3,
            risk: r.risk,
            openQuestion: r.openQuestion || "",
            recommendedAction: r.recommendedAction || "",
            hoursAtRisk: r.hoursAtRisk || 0,
          })),
        });
      }
    }
  } catch (err) {
    console.warn(
      `[import-confirm] Assumptions/risks population failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Update import item
  await prisma.importItem.update({
    where: { id: itemId },
    data: {
      status: "CONFIRMED",
      engagementId: engagement.id,
      matchedAccountId: finalAccountId,
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    },
  });

  // Update job counters
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { confirmedFiles: { increment: 1 } },
  });

  // Check if all items are resolved
  await maybeCompleteJob(importJobId);

  // Fire-and-forget: generate per-stage AI summaries
  import("@/lib/ai/generate-stage-summary").then(({ generateAllStageSummaries }) => {
    generateAllStageSummaries(engagement.id).catch((err) =>
      console.warn(`[import-confirm] Stage summary generation failed: ${err instanceof Error ? err.message : String(err)}`)
    );
  });

  return NextResponse.json({ engagementId: engagement.id });
}

async function maybeCompleteJob(importJobId: string) {
  const counts = await prisma.importItem.groupBy({
    by: ["status"],
    where: { importJobId },
    _count: true,
  });

  const pending = counts.find((c) => c.status === "PENDING_REVIEW")?._count ?? 0;
  if (pending === 0) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "COMPLETED" },
    });
  }
}
