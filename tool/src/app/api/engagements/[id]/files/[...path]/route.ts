import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { downloadFile, getPresignedUrl } from "@/lib/storage";

const PREVIEWABLE_EXTENSIONS = new Set(["md", "csv", "txt", "json", "html"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, path: pathSegments } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  if (engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const relativePath = pathSegments.join("/");

  // Prevent path traversal
  if (relativePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const s3Key = `engagements/${id}/${relativePath}`;
  const ext = relativePath.includes(".")
    ? relativePath.split(".").pop()!.toLowerCase()
    : "";

  // For previewable text files, return content directly
  if (PREVIEWABLE_EXTENSIONS.has(ext)) {
    try {
      const buffer = await downloadFile(s3Key);
      const content = buffer.toString("utf-8");

      return NextResponse.json({
        path: relativePath,
        ext,
        content,
        previewable: true,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `File not found: ${relativePath}` },
        { status: 404 }
      );
    }
  }

  // For non-previewable files, return a presigned download URL
  try {
    const url = await getPresignedUrl(s3Key, 3600);
    return NextResponse.json({
      path: relativePath,
      ext,
      downloadUrl: url,
      previewable: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `File not found: ${relativePath}` },
      { status: 404 }
    );
  }
}
