import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { getEngagementAccess } from "@/lib/engagement-access";

/** Conf buffer table — matches CARL rule 14: Conf 6=0%, 5=25%, 4=50%, 3=50%, 2=75%, 1=100% */
const CONF_BUFFER: Record<number, number> = {
  6: 0,
  5: 0.25,
  4: 0.5,
  3: 0.5,
  2: 0.75,
  1: 1.0,
}

function calcHighHrs(hours: number, conf: number): number {
  const buffer = CONF_BUFFER[conf] ?? 0
  return Math.round(hours * (1 + buffer) * 10) / 10
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const access = await getEngagementAccess(session, id);
    if (!access.canEdit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json() as { itemId?: unknown; hours?: unknown };
    const { itemId, hours } = body;

    if (!itemId || typeof itemId !== "string" || itemId.trim() === "") {
      return NextResponse.json({ error: "itemId must be a non-empty string" }, { status: 400 });
    }
    if (typeof hours !== "number" || !isFinite(hours) || hours < 0) {
      return NextResponse.json({ error: "hours must be a non-negative number" }, { status: 400 });
    }

    // Verify the line item belongs to this engagement
    const existing = await prisma.lineItem.findFirst({
      where: { id: itemId, engagementId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const lowHrs = hours;
    const highHrs = calcHighHrs(hours, existing.conf);

    const updated = await prisma.lineItem.update({
      where: { id: itemId },
      data: { hours, lowHrs, highHrs },
      include: {
        assumptionRefs: { select: { code: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      assumptionCodes: updated.assumptionRefs
        .map((a) => a.code)
        .filter(Boolean)
        .join(", "),
      benchmarkRange:
        updated.benchmarkLowHrs != null && updated.benchmarkHighHrs != null
          ? `${updated.benchmarkLowHrs}-${updated.benchmarkHighHrs}h`
          : null,
    });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
