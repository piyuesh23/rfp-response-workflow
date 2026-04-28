import { NextRequest, NextResponse } from "next/server";
import { generateEstimateXlsx } from "@/lib/excel-export";
import type { EstimateTab } from "@/lib/excel-export";
import { prisma } from "@/lib/db";
import AdmZip from "adm-zip";

/**
 * GET /api/export/excel?engagementId=<id>&deliveryPhaseId=<id>
 *   → single delivery-phase workbook
 * GET /api/export/excel?engagementId=<id>&all=true
 *   → zip of all delivery-phase workbooks
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const engagementId = searchParams.get("engagementId");
  const deliveryPhaseId = searchParams.get("deliveryPhaseId");
  const all = searchParams.get("all") === "true";

  if (!engagementId) {
    return NextResponse.json({ error: "engagementId is required" }, { status: 400 });
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      clientName: true,
      estimationMode: true,
      deliveryPhases: { orderBy: { ordinal: "asc" } },
      lineItems: true,
    },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const safeClient = engagement.clientName.replace(/[^a-zA-Z0-9-_]/g, "-");

  async function buildWorkbookForPhase(
    phaseId: string | null,
    phaseName: string
  ): Promise<Buffer> {
    const items = engagement!.lineItems.filter((li) =>
      phaseId ? li.deliveryPhaseId === phaseId : li.deliveryPhaseId === null
    );

    const TAB_NAMES = ["Backend", "Frontend", "Fixed Cost Items", "AI"] as const;
    const tabs: EstimateTab[] = TAB_NAMES.map((tabName) => ({
      name: tabName,
      rows: items
        .filter((li) => {
          const t = li.tab.toUpperCase();
          if (tabName === "Backend") return t === "BACKEND";
          if (tabName === "Frontend") return t === "FRONTEND";
          if (tabName === "Fixed Cost Items") return t === "FIXED_COST" || t === "DESIGN";
          if (tabName === "AI") return t === "AI";
          return false;
        })
        .map((li) => ({
          task: li.task,
          description: li.description,
          conf: li.conf,
          hours: li.hours,
          lowHrs: li.lowHrs,
          highHrs: li.highHrs,
        })),
    }));

    return generateEstimateXlsx(tabs, `${engagement!.clientName} — ${phaseName}`);
  }

  if (deliveryPhaseId) {
    const phase = engagement.deliveryPhases.find((p) => p.id === deliveryPhaseId);
    if (!phase) {
      return NextResponse.json({ error: "Delivery phase not found" }, { status: 404 });
    }
    const buffer = await buildWorkbookForPhase(deliveryPhaseId, phase.name);
    const slug = phase.name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeClient}-phase${phase.ordinal}-${slug}.xlsx"`,
      },
    });
  }

  if (all && engagement.deliveryPhases.length > 0) {
    const zip = new AdmZip();
    for (const phase of engagement.deliveryPhases) {
      const buffer = await buildWorkbookForPhase(phase.id, phase.name);
      const slug = phase.name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
      zip.addFile(`${safeClient}-phase${phase.ordinal}-${slug}.xlsx`, buffer);
    }
    const zipBuffer = zip.toBuffer();
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeClient}-all-phases.zip"`,
      },
    });
  }

  return NextResponse.json(
    { error: "Specify deliveryPhaseId or all=true for phased exports" },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { tabs: EstimateTab[]; clientName: string };
  const { tabs, clientName } = body;

  if (!tabs || !Array.isArray(tabs)) {
    return NextResponse.json({ error: "tabs must be an array" }, { status: 400 });
  }

  if (!clientName || typeof clientName !== "string") {
    return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  }

  const buffer = await generateEstimateXlsx(tabs, clientName);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeClientName = clientName.replace(/[^a-zA-Z0-9-_]/g, "-");

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeClientName}-estimate.xlsx"`,
    },
  });
}
