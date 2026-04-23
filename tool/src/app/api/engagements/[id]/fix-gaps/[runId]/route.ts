import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: engagementId, runId } = await params;

  const run = await prisma.gapFixRun.findFirst({
    where: { id: runId, engagementId },
    select: {
      id: true,
      status: true,
      gapsBefore: true,
      scoresBefore: true,
      scoresAfter: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(run);
}
