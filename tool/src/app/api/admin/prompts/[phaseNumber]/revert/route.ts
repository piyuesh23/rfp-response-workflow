import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function POST(
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

  await prisma.promptOverride.updateMany({
    where: { phaseNumber, isActive: true },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
