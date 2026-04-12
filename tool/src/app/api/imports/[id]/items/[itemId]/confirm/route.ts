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

  // Extract issueDate / estimatedBudget / deliveryTimeline from item metadata
  // processedFiles carries secondary inference results
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
  function getArtefactConfig(fileType: string): { phaseNumber: string; artefactType: ArtefactType; label: string } | null {
    switch (fileType) {
      case "TOR":
      case "OTHER":
        return { phaseNumber: "0", artefactType: ArtefactType.RESEARCH, label: fileType === "TOR" ? "Imported TOR" : "" };
      case "ESTIMATE":
        return { phaseNumber: "1A", artefactType: ArtefactType.ESTIMATE, label: "Imported Estimate" };
      case "PROPOSAL":
        return { phaseNumber: "5", artefactType: ArtefactType.PROPOSAL, label: "Imported Proposal" };
      case "FINANCIAL":
        return { phaseNumber: "1A", artefactType: ArtefactType.ESTIMATE_STATE, label: "Financial Proposal" };
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
      const artefactConfig = getArtefactConfig(fileMeta.type);
      const subfolder = getS3Subfolder(fileMeta.type, fileMeta.isSubmission ?? false);
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
