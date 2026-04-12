import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id: targetId } = await params;

  const body = await request.json();
  const { sourceAccountId } = body as { sourceAccountId: string };

  if (!sourceAccountId || typeof sourceAccountId !== "string") {
    return NextResponse.json(
      { error: "sourceAccountId is required" },
      { status: 400 }
    );
  }

  if (sourceAccountId === targetId) {
    return NextResponse.json(
      { error: "sourceAccountId and target id must be different" },
      { status: 400 }
    );
  }

  const [target, source] = await Promise.all([
    prisma.account.findUnique({ where: { id: targetId } }),
    prisma.account.findUnique({ where: { id: sourceAccountId } }),
  ]);

  if (!target) {
    return NextResponse.json({ error: "Target account not found" }, { status: 404 });
  }
  if (!source) {
    return NextResponse.json({ error: "Source account not found" }, { status: 404 });
  }

  // Merge in a transaction: move engagements, append alias, delete source
  const updatedTarget = await prisma.$transaction(async (tx) => {
    // Move all engagements from source to target
    await tx.engagement.updateMany({
      where: { accountId: sourceAccountId },
      data: { accountId: targetId },
    });

    // Append source canonicalName to target aliases (deduplicated)
    const existingAliases = target.aliases ?? [];
    const newAliases = Array.from(
      new Set([...existingAliases, source.canonicalName, ...source.aliases])
    );

    const updated = await tx.account.update({
      where: { id: targetId },
      data: { aliases: newAliases },
      include: { _count: { select: { engagements: true } } },
    });

    // Delete source account
    await tx.account.delete({ where: { id: sourceAccountId } });

    return updated;
  });

  return NextResponse.json(updatedTarget);
}
