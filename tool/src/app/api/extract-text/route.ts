import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractTextFromPdf } from "@/lib/pdf-extractor";

/**
 * Extract text from a PDF file without uploading to S3.
 * Used by the engagement creation wizard to get text for AI inference
 * before the engagement (and its S3 prefix) exists.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await extractTextFromPdf(buffer);

    return NextResponse.json({
      text: result.text,
      pageCount: result.pageCount,
      info: result.info,
    });
  } catch (err) {
    console.error("[extract-text] PDF extraction failed:", err);
    return NextResponse.json(
      { error: "Failed to extract text from PDF" },
      { status: 500 }
    );
  }
}
