/**
 * PUT /api/imports/[id]/items/[itemId]/reclassify
 * Reclassify a file within an import item — updates processedFiles and files arrays,
 * and records a ClassificationCorrection for pattern learning.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function PUT(
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
  const body = (await request.json()) as { fullPath: string; newType: string };

  if (!body.fullPath || !body.newType) {
    return NextResponse.json(
      { error: "fullPath and newType are required" },
      { status: 400 }
    );
  }

  const VALID_TYPES = [
    "TOR", "ESTIMATE", "PROPOSAL", "FINANCIAL", "QA_RESPONSE",
    "RESEARCH", "ADDENDUM", "QUESTIONS", "ANNEXURE", "PREREQUISITES",
    "RESPONSE_FORMAT", "OTHER",
  ];
  if (!VALID_TYPES.includes(body.newType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const item = await prisma.importItem.findFirst({
    where: { id: itemId, importJobId },
  });

  if (!item) {
    return NextResponse.json({ error: "Import item not found" }, { status: 404 });
  }

  if (item.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "Can only reclassify items in PENDING_REVIEW status" },
      { status: 409 }
    );
  }

  // Update processedFiles array
  interface ProcessedFileRecord {
    name: string;
    fullPath: string;
    type: string;
    isSubmission: boolean;
    extractedText: boolean;
    artefactCreated: boolean;
    classifiedType?: string;
    classificationConfidence?: number;
    classificationReasoning?: string;
    deliverableMetadata?: Record<string, unknown> | null;
    isTemplate?: boolean;
  }

  const processedFiles = (item.processedFiles as unknown ?? []) as ProcessedFileRecord[];
  const pfRecord = processedFiles.find((pf) => pf.fullPath === body.fullPath);

  if (!pfRecord) {
    return NextResponse.json(
      { error: "File not found in processedFiles" },
      { status: 404 }
    );
  }

  // Record correction for pattern learning
  await prisma.classificationCorrection.create({
    data: {
      fileName: pfRecord.name,
      originalType: pfRecord.classifiedType ?? pfRecord.type,
      correctedType: body.newType,
      originalConfidence: pfRecord.classificationConfidence ?? 0,
      textSnippet: item.extractedTextPreview?.slice(0, 200) ?? null,
      correctedBy: session.user.id,
    },
  });

  // Update the record
  const originalType = pfRecord.classifiedType ?? pfRecord.type;
  pfRecord.classifiedType = body.newType;
  pfRecord.classificationConfidence = 1.0;
  pfRecord.classificationReasoning = `Manual override: ${originalType} → ${body.newType}`;
  pfRecord.type = body.newType;

  // Also update the files array
  interface FileEntry {
    name: string;
    fullPath: string;
    type: string;
    sizeBytes: number;
    isPrimary: boolean;
    isSubmission?: boolean;
  }
  const files = (item.files as unknown as FileEntry[]).map((f) =>
    f.fullPath === body.fullPath ? { ...f, type: body.newType } : f
  );

  await prisma.importItem.update({
    where: { id: itemId },
    data: {
      processedFiles: JSON.parse(JSON.stringify(processedFiles)),
      files: JSON.parse(JSON.stringify(files)),
    },
  });

  return NextResponse.json({ success: true, fullPath: body.fullPath, newType: body.newType });
}
