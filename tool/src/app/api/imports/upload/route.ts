/**
 * POST /api/imports/upload — Upload one or more ZIP files to start import jobs.
 * Admin only. Accepts multipart form data with one or more "file" fields.
 * When multiple files are uploaded, all jobs share a batchId.
 * Single-file uploads are backwards-compatible (returns single job object).
 */
import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { uploadFile } from "@/lib/storage";
import { getImportQueue } from "@/lib/queue";

const MAX_ZIP_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const formData = await request.formData();
  const files = formData.getAll("file") as File[];
  const thresholdRaw = formData.get("autoConfirmThreshold");
  const autoConfirmThreshold =
    thresholdRaw !== null && thresholdRaw !== ""
      ? parseFloat(thresholdRaw as string)
      : undefined;

  if (files.length === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate all files upfront before processing any
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: `Only .zip files are accepted (got: ${file.name})` },
        { status: 400 }
      );
    }
    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json(
        {
          error: `ZIP file "${file.name}" exceeds maximum size of ${MAX_ZIP_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }
  }

  // Generate a batchId when multiple files are uploaded
  const batchId = files.length > 1 ? crypto.randomUUID() : undefined;

  const queue = getImportQueue();
  const createdJobs = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Hash ZIP for deduplication
    const zipHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check for duplicate import (SHA-256 hash match)
    const existingJob = await prisma.importJob.findFirst({
      where: { zipHash, status: { not: "FAILED" } },
    });
    if (existingJob) {
      const statusMessages: Record<string, string> = {
        PENDING: "is queued for processing",
        PROCESSING: "is currently being processed",
        PAUSED: "import is paused",
        REVIEW: "is awaiting review",
        COMPLETED: "has already been imported and reviewed",
      };
      const statusMsg = statusMessages[existingJob.status] ?? "already exists";
      return NextResponse.json(
        {
          error: `This ZIP file (${file.name}) ${statusMsg}. View the existing import to continue.`,
          existingJobId: existingJob.id,
          existingStatus: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Create import job record
    const importJob = await prisma.importJob.create({
      data: {
        userId: session.user.id,
        source: "ZIP_IMPORT",
        sourcePath: file.name,
        zipHash,
        status: "PENDING",
        ...(batchId !== undefined && { batchId }),
        ...(autoConfirmThreshold !== undefined && { autoConfirmThreshold }),
      },
    });

    // Upload ZIP to S3
    await uploadFile(
      `imports/${importJob.id}/upload.zip`,
      buffer,
      "application/zip"
    );

    // Queue background processing
    await queue.add(`import-${importJob.id}`, {
      importJobId: importJob.id,
      userId: session.user.id,
    });

    createdJobs.push(importJob);
  }

  // Backwards compatibility: single file → return single job object
  if (createdJobs.length === 1) {
    return NextResponse.json(createdJobs[0], { status: 201 });
  }

  return NextResponse.json(createdJobs, { status: 201 });
}
