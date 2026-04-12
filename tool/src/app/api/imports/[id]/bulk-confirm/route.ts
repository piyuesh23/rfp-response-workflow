/**
 * POST /api/imports/[id]/bulk-confirm
 * Confirm multiple import items in a single request.
 * Downloads the ZIP once from S3 and processes items in batches of 20.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { uploadFile, downloadFile } from "@/lib/storage";
import { ArtefactType } from "@/generated/prisma/client";
import AdmZip from "adm-zip";
import { extractTextFromPdf } from "@/lib/pdf-extractor";
import { extractTextFromDocx } from "@/lib/docx-extractor";

interface BulkConfirmBody {
  itemIds: string[];
  overrides?: {
    techStack?: string;
    engagementType?: string;
  };
}

interface FileEntry {
  name: string;
  fullPath: string;
  type: string;
  isPrimary: boolean;
  sizeBytes: number;
  isSubmission?: boolean;
}

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

function getMimeType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function getS3Subfolder(fileType: string, isSubmission: boolean): string {
  if (isSubmission) return "submissions";
  switch (fileType) {
    case "TOR":
      return "tor";
    case "ESTIMATE":
      return "estimates";
    case "PROPOSAL":
      return "claude-artefacts";
    case "FINANCIAL":
      return "financials";
    default:
      return "tor";
  }
}

function getArtefactConfig(
  fileType: string
): { phaseNumber: string; artefactType: ArtefactType; label: string } | null {
  switch (fileType) {
    case "TOR":
    case "OTHER":
      return {
        phaseNumber: "0",
        artefactType: ArtefactType.RESEARCH,
        label: fileType === "TOR" ? "Imported TOR" : "",
      };
    case "ESTIMATE":
      return {
        phaseNumber: "1A",
        artefactType: ArtefactType.ESTIMATE,
        label: "Imported Estimate",
      };
    case "PROPOSAL":
      return {
        phaseNumber: "5",
        artefactType: ArtefactType.PROPOSAL,
        label: "Imported Proposal",
      };
    case "FINANCIAL":
      return {
        phaseNumber: "1A",
        artefactType: ArtefactType.ESTIMATE_STATE,
        label: "Financial Proposal",
      };
    default:
      return null;
  }
}

async function confirmItem(
  item: {
    id: string;
    importJobId: string;
    folderName: string;
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
    files: unknown;
    processedFiles: unknown;
  },
  zip: AdmZip,
  overrides: { techStack?: string; engagementType?: string } | undefined,
  userId: string
): Promise<string> {
  const clientName = item.inferredClient || item.folderName;
  const projectName = item.inferredProjectName || item.folderName;
  const techStack = overrides?.techStack || item.inferredTechStack || "DRUPAL";
  const engagementType =
    overrides?.engagementType || item.inferredEngagementType || "NEW_BUILD";

  // Find or create account
  let finalAccountId: string | null = item.matchedAccountId;
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

  // Determine phases from file types
  const allFiles = item.files as unknown as FileEntry[];
  const hasEstimate = allFiles.some((f) => f.type === "ESTIMATE");
  const hasProposal = allFiles.some((f) => f.type === "PROPOSAL");
  const hasFinancial = allFiles.some((f) => f.type === "FINANCIAL");

  const phasesToCreate: Array<{ phaseNumber: string; status: "APPROVED" }> = [
    { phaseNumber: "0", status: "APPROVED" },
  ];
  if (hasEstimate || hasFinancial) {
    phasesToCreate.push({ phaseNumber: "1A", status: "APPROVED" });
  }
  if (hasProposal) {
    phasesToCreate.push({ phaseNumber: "5", status: "APPROVED" });
  }

  // Merge budget/timeline from secondary docs
  const processedFiles = (item.processedFiles ?? []) as ProcessedFileRecord[];
  let estimatedBudget: number | null = null;
  let deliveryTimeline: string | null = null;
  for (const pf of processedFiles) {
    if (pf.inferredBudget != null) estimatedBudget = pf.inferredBudget;
    if (pf.inferredTimeline != null) deliveryTimeline = pf.inferredTimeline;
  }

  // Create engagement with phases
  const engagement = await prisma.engagement.create({
    data: {
      clientName,
      projectName,
      techStack: techStack as "DRUPAL",
      engagementType: engagementType as "NEW_BUILD",
      status: "ARCHIVED",
      accountId: finalAccountId,
      createdById: userId,
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

  // Process files from ZIP
  try {
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
          `[bulk-confirm] S3 upload failed for ${fileMeta.fullPath}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`
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
            }

            if (extractedText) {
              const versionKey = `${phaseId}:${artefactConfig.artefactType}`;
              const version = (artefactVersions.get(versionKey) ?? 0) + 1;
              artefactVersions.set(versionKey, version);

              const artefactLabel =
                artefactConfig.label || `Imported: ${fileMeta.name}`;

              await prisma.phaseArtefact.create({
                data: {
                  phaseId,
                  artefactType: artefactConfig.artefactType,
                  version,
                  label: artefactLabel,
                  contentMd: extractedText,
                  fileUrl: `engagements/${engagement.id}/${subfolder}/${fileMeta.name}`,
                },
              });
            }
          } catch (artefactErr) {
            console.warn(
              `[bulk-confirm] Artefact creation failed for ${fileMeta.fullPath}: ${artefactErr instanceof Error ? artefactErr.message : String(artefactErr)}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      `[bulk-confirm] File processing failed for engagement ${engagement.id}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Update import item
  await prisma.importItem.update({
    where: { id: item.id },
    data: {
      status: "CONFIRMED",
      engagementId: engagement.id,
      matchedAccountId: finalAccountId,
      reviewedAt: new Date(),
      reviewedBy: userId,
    },
  });

  return engagement.id;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id: importJobId } = await params;
  const body = (await request.json().catch(() => ({}))) as BulkConfirmBody;
  const { itemIds = [], overrides } = body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds must be a non-empty array" }, { status: 400 });
  }

  // Validate all items exist, belong to this job, and are PENDING_REVIEW
  const items = await prisma.importItem.findMany({
    where: {
      id: { in: itemIds },
      importJobId,
      status: "PENDING_REVIEW",
    },
  });

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid PENDING_REVIEW items found for this import job" },
      { status: 400 }
    );
  }

  // Download ZIP once for all items
  let zip: AdmZip;
  try {
    const zipBuffer = await downloadFile(`imports/${importJobId}/upload.zip`);
    zip = new AdmZip(zipBuffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to download import ZIP: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }

  const BATCH_SIZE = 20;
  let confirmed = 0;
  const errors: Array<{ itemId: string; error: string }> = [];

  // Process in batches to avoid transaction timeouts
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          await confirmItem(item, zip, overrides, session.user.id);
          confirmed++;
        } catch (err) {
          errors.push({
            itemId: item.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }

  // Update job counters once after all items processed
  if (confirmed > 0) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { confirmedFiles: { increment: confirmed } },
    });
  }

  // Check if all items are resolved → set job to COMPLETED
  const pendingCount = await prisma.importItem.count({
    where: { importJobId, status: "PENDING_REVIEW" },
  });
  if (pendingCount === 0) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({
    confirmed,
    failed: errors.length,
    errors,
  });
}
