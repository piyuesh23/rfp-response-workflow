import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import type { UserRole } from "@/generated/prisma/enums";

const VALID_ROLES: UserRole[] = ["ADMIN", "MANAGER", "VIEWER"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;
  const body = await request.json();
  const { role, isBlocked } = body as {
    role?: UserRole;
    isBlocked?: boolean;
  };

  // Prevent admin from blocking themselves
  if (isBlocked === true && id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot block your own account" },
      { status: 400 }
    );
  }

  // Validate role if provided
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (isBlocked !== undefined) {
    data.isBlocked = isBlocked;
    data.blockedAt = isBlocked ? new Date() : null;
    data.blockedBy = isBlocked ? session.user.id : null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      blockedAt: true,
    },
  });

  return NextResponse.json(updated);
}
