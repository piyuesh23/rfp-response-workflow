import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRoles, guardErrorStatus } from "@/lib/auth-guard";
import type { Industry, Region, AccountTier } from "@/generated/prisma/client";

export async function GET() {
  try {
    await requireAuth();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const accounts = await prisma.account.findMany({
    orderBy: { canonicalName: "asc" },
    include: {
      _count: { select: { engagements: true } },
    },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  try {
    await requireRoles("ADMIN", "MANAGER");
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
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
    canonicalName: string;
    industry?: Industry;
    region?: Region;
    accountTier?: AccountTier;
    primaryContact?: string;
    contactEmail?: string;
    notes?: string;
  };

  if (!canonicalName || typeof canonicalName !== "string" || !canonicalName.trim()) {
    return NextResponse.json(
      { error: "canonicalName is required" },
      { status: 400 }
    );
  }

  // Case-insensitive uniqueness check
  const existing = await prisma.account.findFirst({
    where: {
      canonicalName: { equals: canonicalName.trim(), mode: "insensitive" },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with this name already exists" },
      { status: 409 }
    );
  }

  const account = await prisma.account.create({
    data: {
      canonicalName: canonicalName.trim(),
      ...(industry !== undefined && { industry }),
      ...(region !== undefined && { region }),
      ...(accountTier !== undefined && { accountTier }),
      ...(primaryContact !== undefined && { primaryContact }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      _count: { select: { engagements: true } },
    },
  });

  return NextResponse.json(account, { status: 201 });
}
