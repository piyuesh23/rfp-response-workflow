import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { PHASE_LABELS } from "@/lib/ai/prompts/defaults";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  // Get the latest active override per phase+promptType
  const overrides = await prisma.promptOverride.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  // Build a map of phaseNumber -> latest updatedAt
  const phaseOverrideMap: Record<string, Date> = {};
  for (const o of overrides) {
    const existing = phaseOverrideMap[o.phaseNumber];
    if (!existing || o.updatedAt > existing) {
      phaseOverrideMap[o.phaseNumber] = o.updatedAt;
    }
  }

  const phases = Object.entries(PHASE_LABELS).map(([phaseNumber, label]) => {
    const lastModified = phaseOverrideMap[phaseNumber] ?? null;
    return {
      phaseNumber,
      label,
      source: lastModified ? "override" : "code",
      lastModified: lastModified ? lastModified.toISOString() : null,
    };
  });

  return NextResponse.json(phases);
}
