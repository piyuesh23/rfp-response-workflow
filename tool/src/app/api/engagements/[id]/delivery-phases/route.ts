import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const phases = await prisma.deliveryPhase.findMany({
    where: { engagementId: id },
    orderBy: { ordinal: "asc" },
  });
  return NextResponse.json(phases);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    summary?: string;
    scopeBullets?: string[];
    targetDurationWeeks?: number | null;
    ordinal?: number;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Determine next ordinal if not provided
  let ordinal = body.ordinal;
  if (!ordinal) {
    const last = await prisma.deliveryPhase.findFirst({
      where: { engagementId: id },
      orderBy: { ordinal: "desc" },
    });
    ordinal = (last?.ordinal ?? 0) + 1;
  }

  const phase = await prisma.deliveryPhase.create({
    data: {
      engagementId: id,
      ordinal,
      name: body.name.trim(),
      summary: body.summary?.trim() ?? "",
      scopeBullets: body.scopeBullets ?? [],
      targetDurationWeeks: body.targetDurationWeeks ?? null,
      sourceType: "USER_DEFINED",
      status: "DRAFT",
    },
  });

  return NextResponse.json(phase, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    action?: "reorder" | "confirm-all" | "set-mode";
    ordinals?: Array<{ id: string; ordinal: number }>;
    estimationMode?: "BIG_BANG" | "PHASED" | "UNDECIDED";
  };

  if (body.action === "reorder" && body.ordinals) {
    await prisma.$transaction(
      body.ordinals.map((item) =>
        prisma.deliveryPhase.update({
          where: { id: item.id },
          data: { ordinal: item.ordinal },
        })
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "confirm-all") {
    await prisma.deliveryPhase.updateMany({
      where: { engagementId: id, status: "DRAFT" },
      data: { status: "CONFIRMED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set-mode" && body.estimationMode) {
    await prisma.engagement.update({
      where: { id },
      data: { estimationMode: body.estimationMode },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
