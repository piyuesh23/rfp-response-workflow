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

    const lineItems = await prisma.lineItem.findMany({
      where: { engagementId: id },
      orderBy: [{ tab: "asc" }, { createdAt: "asc" }],
      include: {
        assumptionRefs: {
          select: { code: true },
        },
      },
    });

    // Flatten assumption codes into a comma-separated string for each line item
    return NextResponse.json(
      lineItems.map((li) => ({
        ...li,
        assumptionCodes: li.assumptionRefs
          .map((a) => a.code)
          .filter(Boolean)
          .join(", "),
        benchmarkRange:
          li.benchmarkLowHrs != null && li.benchmarkHighHrs != null
            ? `${li.benchmarkLowHrs}-${li.benchmarkHighHrs}h`
            : null,
      }))
    );
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
