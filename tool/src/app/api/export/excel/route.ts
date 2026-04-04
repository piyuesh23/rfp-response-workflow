import { NextRequest, NextResponse } from "next/server";
import { generateEstimateXlsx } from "@/lib/excel-export";
import type { EstimateTab } from "@/lib/excel-export";

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
