import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile, S3_BUCKET } from "@/lib/storage";
import {
  isPdf,
  extractTextFromPdf,
  pdfTextToMarkdown,
} from "@/lib/pdf-extractor";

const MAX_UPLOAD_SIZE = 30 * 1024 * 1024; // 30MB per file

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const engagementId = formData.get("engagementId");

  if (!engagementId || typeof engagementId !== "string") {
    return NextResponse.json(
      { error: "engagementId is required in form data" },
      { status: 400 }
    );
  }

  // Optional prefix to control which subdirectory files land in (default: tor)
  const prefix = (formData.get("prefix") as string) || "tor";
  // Sanitize prefix to prevent path traversal
  const safePrefix = prefix.replace(/\.\./g, "").replace(/^\/+/, "");

  const files = formData.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results: {
    filename: string;
    key: string;
    url: string;
    extractedMd?: string;
  }[] = [];

  for (const file of files) {
    const filename = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Enforce upload size limit
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error: `File "${filename}" exceeds maximum size of ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`,
        },
        { status: 413 }
      );
    }

    const key = `engagements/${engagementId}/${safePrefix}/${filename}`;
    await uploadFile(key, buffer, file.type || "application/octet-stream");

    const url = `s3://${S3_BUCKET}/${key}`;
    const result: (typeof results)[number] = { filename, key, url };

    // Auto-extract text from PDFs and save as .md alongside the original
    if (isPdf(filename)) {
      try {
        const extraction = await extractTextFromPdf(buffer);
        const markdown = pdfTextToMarkdown(extraction, filename);
        const mdFilename = filename.replace(/\.pdf$/i, ".md");
        const mdKey = `engagements/${engagementId}/${safePrefix}/${mdFilename}`;
        await uploadFile(mdKey, markdown, "text/markdown");
        result.extractedMd = mdFilename;
      } catch {
        // PDF extraction failure is non-fatal — original PDF is still uploaded
      }
    }

    results.push(result);
  }

  return NextResponse.json({ files: results }, { status: 201 });
}
