import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile, S3_BUCKET } from "@/lib/storage";

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

  const files = formData.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results: { filename: string; key: string; url: string }[] = [];

  for (const file of files) {
    const filename = file.name;
    const key = `engagements/${engagementId}/tor/${filename}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadFile(key, buffer, file.type || "application/octet-stream");

    // Construct a public-style URL; presigned URLs can be fetched separately
    const url = `s3://${S3_BUCKET}/${key}`;
    results.push({ filename, key, url });
  }

  return NextResponse.json({ files: results }, { status: 201 });
}
