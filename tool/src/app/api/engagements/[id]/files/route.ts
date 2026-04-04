import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listObjects } from "@/lib/storage";

export interface FileEntry {
  key: string;
  name: string;
  dir: string;
  ext: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  const prefix = `engagements/${id}/`;

  try {
    const keys = await listObjects(prefix);

    const files: FileEntry[] = keys.map((key) => {
      const relativePath = key.replace(prefix, "");
      const parts = relativePath.split("/");
      const name = parts[parts.length - 1];
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

      return { key, name, dir, ext };
    });

    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to list files: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
