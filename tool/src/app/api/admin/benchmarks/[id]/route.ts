import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

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
  const body = await request.json();
  const { lowHours, highHours, tier, notes, category, taskType } = body as {
    lowHours?: number;
    highHours?: number;
    tier?: string | null;
    notes?: string | null;
    category?: string;
    taskType?: string;
  };

  const existing = await prisma.benchmark.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
  }

  const resolvedLow = lowHours ?? existing.lowHours;
  const resolvedHigh = highHours ?? existing.highHours;
  if (resolvedLow < 0 || resolvedHigh < 0 || resolvedLow > resolvedHigh) {
    return NextResponse.json(
      { error: "lowHours must be >= 0 and <= highHours" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (lowHours !== undefined) data.lowHours = lowHours;
  if (highHours !== undefined) data.highHours = highHours;
  if (tier !== undefined) data.tier = tier;
  if (notes !== undefined) data.notes = notes;
  if (category !== undefined) data.category = category;
  if (taskType !== undefined) data.taskType = taskType;

  const updated = await prisma.benchmark.update({
    where: { id },
    data,
  });

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

  const existing = await prisma.benchmark.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Benchmark not found" }, { status: 404 });
  }

  const updated = await prisma.benchmark.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}
