/**
 * GET /api/imports/[id] — Get import job details with all items.
 * PATCH /api/imports/[id] — Update job status (PAUSED | PROCESSING for pause/resume).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { getImportQueue } from "@/lib/queue";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { folderName: "asc" },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await request.json() as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body;

  if (status !== "PAUSED" && status !== "PROCESSING") {
    return NextResponse.json(
      { error: "status must be PAUSED or PROCESSING" },
      { status: 400 }
    );
  }

  const existing = await prisma.importJob.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  // Validate transition
  if (status === "PAUSED" && existing.status !== "PROCESSING") {
    return NextResponse.json(
      { error: "Can only pause a PROCESSING job" },
      { status: 409 }
    );
  }
  if (status === "PROCESSING" && existing.status !== "PAUSED") {
    return NextResponse.json(
      { error: "Can only resume a PAUSED job" },
      { status: 409 }
    );
  }

  const updated = await prisma.importJob.update({
    where: { id },
    data: { status },
  });

  // On resume: re-queue the job so the worker picks it up again
  if (status === "PROCESSING") {
    const queue = getImportQueue();
    await queue.add(`import-${id}`, {
      importJobId: id,
      userId: existing.userId,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  const job = await prisma.importJob.findUnique({
    where: { id },
    include: { items: { select: { id: true, engagementId: true } } },
  });

  if (!job) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  // Delete all engagements created from this import
  const engagementIds = job.items
    .map((item) => item.engagementId)
    .filter((eid): eid is string => eid !== null);

  if (engagementIds.length > 0) {
    await prisma.engagement.deleteMany({
      where: { id: { in: engagementIds } },
    });
  }

  // Delete the import job (cascades to ImportItems via onDelete: Cascade)
  await prisma.importJob.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
