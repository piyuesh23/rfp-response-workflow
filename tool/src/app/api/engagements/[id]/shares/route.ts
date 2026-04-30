import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import type { ShareAccessLevel } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id: engagementId } = await params;
    await requireEngagementEdit(session, engagementId);

    const shares = await prisma.engagementShare.findMany({
      where: { engagementId, revokedAt: null },
      select: {
        id: true,
        email: true,
        accessLevel: true,
        createdAt: true,
        user: { select: { name: true, avatarUrl: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(shares);
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id: engagementId } = await params;
    await requireEngagementEdit(session, engagementId);

    const body = await req.json();
    const email = (body.email as string | undefined)?.toLowerCase().trim();
    const accessLevel = body.accessLevel as ShareAccessLevel | undefined;

    if (!email || !accessLevel) {
      return NextResponse.json(
        { error: "email and accessLevel are required" },
        { status: 400 },
      );
    }
    if (!["READ_ONLY", "FULL_ACCESS"].includes(accessLevel)) {
      return NextResponse.json(
        { error: "accessLevel must be READ_ONLY or FULL_ACCESS" },
        { status: 400 },
      );
    }

    const existing = await prisma.engagementShare.findFirst({
      where: { engagementId, email, revokedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An active share for this email already exists" },
        { status: 409 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const share = await prisma.engagementShare.create({
      data: {
        engagementId,
        email,
        userId: user?.id ?? null,
        accessLevel,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(share, { status: 201 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
