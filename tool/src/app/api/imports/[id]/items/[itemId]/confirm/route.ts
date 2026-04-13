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
  const hasTorOrQuestions = allFiles.some((f) => ["TOR", "QUESTIONS"].includes(getEffectiveType(f)));

  const phasesToCreate: Array<{ phaseNumber: string; status: "APPROVED" }> = [
    { phaseNumber: "0", status: "APPROVED" },
  ];
  if (hasTorOrQuestions) {
    phasesToCreate.push({ phaseNumber: "1", status: "APPROVED" });
  }
  if (hasEstimate || hasFinancial) {
    phasesToCreate.push({ phaseNumber: "1A", status: "APPROVED" });
  }
  if (hasAddendum) {
    phasesToCreate.push({ phaseNumber: "2", status: "APPROVED" });
  }
  if (hasProposal) {
    phasesToCreate.push({ phaseNumber: "5", status: "APPROVED" });
  }

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
      status: "ARCHIVED",
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
        ai: EstimateRow[];
      };

      const XLSX_DATA_START_ROW = 7;

      const tabConfigs = [
        { name: "Backend", data: rawData.backend, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
        { name: "Frontend", data: rawData.frontend, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 9, extra: 10, links: 11 } },
        { name: "Fixed Cost Items", data: rawData.fixedCost, cols: { task: 2, desc: 3, hrs: 5, conf: 6, low: 7, high: 8, assumptions: 11, extra: -1, links: 13 } },
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
    } catch (err) {
      console.warn(`[import-confirm] Failed to populate estimate template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4D: Prefer submission folder files for financial metadata
  const submissionFinancial = processedFiles.find(
    (pf) => pf.isSubmission && pf.classifiedType === "FINANCIAL"
  );
  if (submissionFinancial?.deliverableMetadata) {
    const meta = submissionFinancial.deliverableMetadata as { totalCost?: number };
    if (meta.totalCost) {
      await prisma.engagement.update({
        where: { id: engagement.id },
        data: { financialProposalValue: meta.totalCost },
      });
    }
  }

  // Helper: get MIME type
  function getMimeType(fileName: string): string {
    return fileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // Helper: get S3 subfolder by file type
  function getS3Subfolder(fileType: string, isSubmission: boolean): string {
    if (isSubmission) return "submissions";
    switch (fileType) {
      case "TOR": return "tor";
      case "ESTIMATE": return "estimates";
      case "PROPOSAL": return "claude-artefacts";
      case "FINANCIAL": return "financials";
      default: return "tor";
    }
  }

  // Helper: map file type to artefact type and phase
  // Accepts an optional aiClassifiedType to prefer over the static file type
  function getArtefactConfig(fileType: string, aiClassifiedType?: string): { phaseNumber: string; artefactType: ArtefactType; label: string } | null {
    const effectiveType = aiClassifiedType ?? fileType;
    switch (effectiveType) {
      case "TOR":
      case "OTHER":
        return { phaseNumber: "0", artefactType: ArtefactType.RESEARCH, label: effectiveType === "TOR" ? "Imported TOR" : "" };
      case "ESTIMATE":
        return { phaseNumber: "1A", artefactType: ArtefactType.ESTIMATE, label: "Imported Estimate" };
      case "PROPOSAL":
        return { phaseNumber: "5", artefactType: ArtefactType.PROPOSAL, label: "Imported Proposal" };
      case "FINANCIAL":
        return { phaseNumber: "1A", artefactType: ArtefactType.ESTIMATE_STATE, label: "Financial Proposal" };
      case "QA_RESPONSE":
        return { phaseNumber: "0", artefactType: ArtefactType.RESEARCH, label: "Imported Q&A Response" };
      case "RESEARCH":
        return { phaseNumber: "0", artefactType: ArtefactType.RESEARCH, label: "Imported Research" };
      case "ADDENDUM":
        return { phaseNumber: "2", artefactType: ArtefactType.RESPONSE_ANALYSIS, label: "Imported Addendum" };
      case "QUESTIONS":
        return { phaseNumber: "1", artefactType: ArtefactType.QUESTIONS, label: "Imported Questions" };
      default:
        return null;
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

      // Create artefact if we have a matching phase
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
            }

            if (extractedText) {
              const versionKey = `${phaseId}:${artefactConfig.artefactType}`;
              const version = (artefactVersions.get(versionKey) ?? 0) + 1;
              artefactVersions.set(versionKey, version);

              const artefactLabel = artefactConfig.label || `Imported: ${fileMeta.name}`;

              await prisma.phaseArtefact.create({
                data: {
                  phaseId,
                  artefactType: artefactConfig.artefactType,
                  version,
                  label: artefactLabel,
                  contentMd: extractedText,
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
