import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRoles, requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import type { Industry, Region, AccountTier } from "@/generated/prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      engagements: {
        orderBy: { updatedAt: "desc" },
        include: {
          phases: {
            select: { phaseNumber: true, status: true },
          },
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoles("ADMIN", "MANAGER");
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    canonicalName,
    industry,
    region,
    accountTier,
    primaryContact,
    contactEmail,
    notes,
  } = body as {
    canonicalName?: string;
    industry?: Industry;
    region?: Region;
    accountTier?: AccountTier;
    primaryContact?: string;
    contactEmail?: string;
    notes?: string;
  };

  // If canonicalName is being changed, check uniqueness
  if (canonicalName !== undefined) {
    const trimmed = canonicalName.trim();
    const conflict = await prisma.account.findFirst({
      where: {
        canonicalName: { equals: trimmed, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "An account with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...(canonicalName !== undefined && { canonicalName: canonicalName.trim() }),
      ...(industry !== undefined && { industry }),
      ...(region !== undefined && { region }),
      ...(accountTier !== undefined && { accountTier }),
      ...(primaryContact !== undefined && { primaryContact }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await params;

  const existing = await prisma.account.findUnique({
    where: { id },
    include: { _count: { select: { engagements: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (existing._count.engagements > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete account with linked engagements (${existing._count.engagements} found). Remove or reassign engagements first.`,
      },
      { status: 409 }
    );
  }

  await prisma.account.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
