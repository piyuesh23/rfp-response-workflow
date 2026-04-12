/**
 * POST /api/imports/[id]/items/[itemId]/skip
 * Skip an import item — marks it as SKIPPED without creating an engagement.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id: importJobId, itemId } = await params;

  const item = await prisma.importItem.findFirst({
    where: { id: itemId, importJobId },
  });

  if (!item) {
    return NextResponse.json({ error: "Import item not found" }, { status: 404 });
  }

  if (item.status !== "PENDING_REVIEW" && item.status !== "FAILED") {
    return NextResponse.json(
      { error: `Cannot skip item with status ${item.status}` },
      { status: 400 }
    );
  }

  await prisma.importItem.update({
    where: { id: itemId },
    data: {
      status: "SKIPPED",
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    },
  });

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { skippedFiles: { increment: 1 } },
  });

  // Check if all items are resolved
  const pending = await prisma.importItem.count({
    where: { importJobId, status: "PENDING_REVIEW" },
  });
  if (pending === 0) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ success: true });
}
