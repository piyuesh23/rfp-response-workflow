import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { getDefaultPrompt, PHASE_LABELS } from "@/lib/ai/prompts/defaults";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phaseNumber: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { phaseNumber } = await params;
  const label = PHASE_LABELS[phaseNumber] ?? `Phase ${phaseNumber}`;

  // Get active overrides for this phase
  const activeOverrides = await prisma.promptOverride.findMany({
    where: { phaseNumber, isActive: true },
    orderBy: { version: "desc" },
  });

  // Get full version history
  const history = await prisma.promptOverride.findMany({
    where: { phaseNumber },
    orderBy: { version: "desc" },
    select: {
      id: true,
      promptType: true,
      version: true,
      isActive: true,
      notes: true,
      createdBy: true,
      createdAt: true,
    },
  });

  const systemOverride = activeOverrides.find((o) => o.promptType === "SYSTEM");
  const userOverride = activeOverrides.find((o) => o.promptType === "USER");

  const defaultContent = getDefaultPrompt(phaseNumber);

  return NextResponse.json({
    phaseNumber,
    label,
    source: activeOverrides.length > 0 ? "override" : "code",
    systemPrompt: {
      content: systemOverride?.content ?? defaultContent,
      source: systemOverride ? "override" : "code",
      version: systemOverride?.version ?? null,
    },
    userPrompt: {
      content: userOverride?.content ?? defaultContent,
      source: userOverride ? "override" : "code",
      version: userOverride?.version ?? null,
    },
    history,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ phaseNumber: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { phaseNumber } = await params;
  const body = await req.json();
  const { promptType, content, notes } = body as {
    promptType: string;
    content: string;
    notes?: string;
  };

  if (!promptType || !content) {
    return NextResponse.json(
      { error: "promptType and content are required" },
      { status: 400 }
    );
  }

  if (promptType !== "SYSTEM" && promptType !== "USER") {
    return NextResponse.json(
      { error: "promptType must be SYSTEM or USER" },
      { status: 400 }
    );
  }

  // Get max existing version for this phase+promptType
  const latest = await prisma.promptOverride.findFirst({
    where: { phaseNumber, promptType },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  // Deactivate previous active overrides for same phase+promptType
  await prisma.promptOverride.updateMany({
    where: { phaseNumber, promptType, isActive: true },
    data: { isActive: false },
  });

  // Create new override
  const override = await prisma.promptOverride.create({
    data: {
      phaseNumber,
      promptType,
      content,
      version: nextVersion,
      isActive: true,
      createdBy: session.user.email ?? session.user.id,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(override, { status: 201 });
}
