import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const url = new URL(request.url);
  const creator = url.searchParams.get("creator");
  const status = url.searchParams.get("status");
  const techStack = url.searchParams.get("techStack");

  const where: Record<string, unknown> = {};
  if (creator) where.createdById = creator;
  if (status) where.status = status;
  if (techStack) where.techStack = techStack;

  const engagements = await prisma.engagement.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      phases: {
        select: { phaseNumber: true, status: true },
        orderBy: { phaseNumber: "asc" },
      },
    },
  });

  return NextResponse.json(engagements);
}
