/**
 * PUT /api/imports/[id]/batch-outcomes
 * Batch update outcomes for all confirmed engagements in an import job.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import type { EngagementOutcome, LossReason } from "@/generated/prisma/client";

interface OutcomeUpdate {
  engagementId: string;
  outcome: string;
  lossReason?: string | null;
  actualContractValue?: number | null;
  competitorWhoWon?: string | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { id: importJobId } = await params;
  const body = (await request.json()) as { outcomes: OutcomeUpdate[] };

  if (!body.outcomes || !Array.isArray(body.outcomes) || body.outcomes.length === 0) {
    return NextResponse.json({ error: "outcomes array required" }, { status: 400 });
  }

  // Verify the import job exists
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  // Batch update using transaction
  const updates = body.outcomes.map((o) =>
    prisma.engagement.update({
      where: { id: o.engagementId },
      data: {
        outcome: o.outcome as EngagementOutcome,
        lossReason: (o.lossReason ?? null) as LossReason | null,
        actualContractValue: o.actualContractValue ?? null,
        competitorWhoWon: o.competitorWhoWon ?? null,
        outcomeRecordedAt: new Date(),
        outcomeRecordedBy: session.user.id,
      },
    })
  );

  try {
    await prisma.$transaction(updates);
    return NextResponse.json({ updated: updates.length });
  } catch (err) {
    return NextResponse.json(
      { error: `Batch update failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
