import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { key, id } = await params;

  const config = await prisma.promptConfig.findUnique({ where: { key } });
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = await prisma.promptVersion.findFirst({
    where: { id, promptConfigId: config.id },
  });

  if (!version) {
    return NextResponse.json(
      { error: "Version not found for this prompt config" },
      { status: 404 }
    );
  }

  // Snapshot current content before restoring
  await prisma.promptVersion.create({
    data: {
      promptConfigId: config.id,
      content: config.content,
      changedBy: session.user.email ?? session.user.id,
      changeNote: `Restored from version ${id}`,
    },
  });

  const updated = await prisma.promptConfig.update({
    where: { key },
    data: {
      content: version.content,
      isDefault: false,
      updatedBy: session.user.email ?? session.user.id,
    },
  });

  return NextResponse.json(updated);
}
