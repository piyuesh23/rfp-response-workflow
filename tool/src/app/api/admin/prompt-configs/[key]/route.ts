import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAuth();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { key } = await params;

  const config = await prisma.promptConfig.findUnique({
    where: { key },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(config);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { key } = await params;

  const body = await req.json();
  const { content, changeNote } = body as {
    content: string;
    changeNote?: string;
  };

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const existing = await prisma.promptConfig.findUnique({ where: { key } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create a version snapshot of the old content first
  await prisma.promptVersion.create({
    data: {
      promptConfigId: existing.id,
      content: existing.content,
      changedBy: session.user.email ?? session.user.id,
      changeNote: changeNote ?? null,
    },
  });

  const updated = await prisma.promptConfig.update({
    where: { key },
    data: {
      content,
      isDefault: false,
      updatedBy: session.user.email ?? session.user.id,
    },
  });

  return NextResponse.json(updated);
}
