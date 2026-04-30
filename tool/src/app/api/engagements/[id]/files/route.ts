import { NextRequest, NextResponse } from "next/server";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { getEngagementAccess } from "@/lib/engagement-access";
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
  try {
  const session = await requireAuth();
  const { id } = await params;

  const access = await getEngagementAccess(session, id);
  if (!access.canRead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  } catch {
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
