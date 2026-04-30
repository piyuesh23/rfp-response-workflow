import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { getEngagementAccess } from "@/lib/engagement-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const access = await getEngagementAccess(session, id);
    if (!access.canRead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assumptions = await prisma.assumption.findMany({
      where: { engagementId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(assumptions);
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
