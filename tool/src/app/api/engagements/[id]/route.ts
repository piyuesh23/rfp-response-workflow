import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { EngagementStatus, RfpSource } from "@/generated/prisma/enums";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: {
      phases: {
        orderBy: { phaseNumber: "asc" },
        include: {
          artefacts: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  if (engagement.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(engagement);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  if (existing.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    clientName,
    projectName,
    status,
    workflowPath,
    rfpSource,
    estimatedDealValue,
    submissionDeadline,
    presalesOwner,
    salesOwner,
    isCompetitiveBid,
    accountId,
  } = body as {
    clientName?: string;
    projectName?: string;
    status?: EngagementStatus;
    workflowPath?: string;
    rfpSource?: RfpSource;
    estimatedDealValue?: number;
    submissionDeadline?: string;
    presalesOwner?: string;
    salesOwner?: string;
    isCompetitiveBid?: boolean;
    accountId?: string;
  };

  const updated = await prisma.engagement.update({
    where: { id },
    data: {
      ...(clientName !== undefined && { clientName }),
      ...(projectName !== undefined && { projectName }),
      ...(status !== undefined && { status }),
      ...(workflowPath !== undefined && { workflowPath: workflowPath as "NO_RESPONSE" | "HAS_RESPONSE" }),
      ...(rfpSource !== undefined && { rfpSource }),
      ...(estimatedDealValue !== undefined && { estimatedDealValue }),
      ...(submissionDeadline !== undefined && { submissionDeadline: new Date(submissionDeadline) }),
      ...(presalesOwner !== undefined && { presalesOwner }),
      ...(salesOwner !== undefined && { salesOwner }),
      ...(isCompetitiveBid !== undefined && { isCompetitiveBid }),
      ...(accountId !== undefined && { accountId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  if (existing.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clean up any linked ImportItem (from ZIP imports)
  await prisma.importItem.updateMany({
    where: { engagementId: id },
    data: {
      engagementId: null,
      status: "SKIPPED",
    },
  });

  await prisma.engagement.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
