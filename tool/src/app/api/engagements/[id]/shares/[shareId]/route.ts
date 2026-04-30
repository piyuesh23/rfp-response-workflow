import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import type { ShareAccessLevel } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string; shareId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id: engagementId, shareId } = await params;
    await requireEngagementEdit(session, engagementId);

    const body = await req.json();
    const accessLevel = body.accessLevel as ShareAccessLevel | undefined;
    if (!accessLevel || !["READ_ONLY", "FULL_ACCESS"].includes(accessLevel)) {
      return NextResponse.json(
        { error: "accessLevel must be READ_ONLY or FULL_ACCESS" },
        { status: 400 },
      );
    }

    const share = await prisma.engagementShare.findFirst({
      where: { id: shareId, engagementId, revokedAt: null },
    });
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const updated = await prisma.engagementShare.update({
      where: { id: shareId },
      data: { accessLevel },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id: engagementId, shareId } = await params;
    await requireEngagementEdit(session, engagementId);

    const share = await prisma.engagementShare.findFirst({
      where: { id: shareId, engagementId, revokedAt: null },
    });
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await prisma.engagementShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date(), revokedById: session.user.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
