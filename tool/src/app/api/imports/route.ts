/**
 * GET /api/imports — List import jobs (admin only)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(jobs);
}
