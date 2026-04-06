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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isBlocked: true,
      blockedAt: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { engagements: true } },
    },
  });

  return NextResponse.json(users);
}
