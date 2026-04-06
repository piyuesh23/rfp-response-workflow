import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the engagement belongs to the requesting user
  const engagement = await prisma.engagement.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  if (engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assumptions = await prisma.assumption.findMany({
    where: { engagementId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(assumptions);
}
