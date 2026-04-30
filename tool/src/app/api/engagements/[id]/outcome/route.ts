import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { EngagementOutcome, LossReason } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await requireAuth();
  const { id } = await params;

  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  await requireEngagementEdit(session, id);

  const body = await request.json();
  const {
    outcome,
    lossReason,
    lossReasonDetail,
    winFactors,
    competitorWhoWon,
    actualContractValue,
    outcomeFeedback,
  } = body as {
    outcome?: EngagementOutcome;
    lossReason?: LossReason;
    lossReasonDetail?: string;
    winFactors?: string[];
    competitorWhoWon?: string;
    actualContractValue?: number;
    outcomeFeedback?: string;
  };

  if (!outcome) {
    return NextResponse.json(
      { error: "outcome is required" },
      { status: 400 }
    );
  }

  const validOutcomes = Object.values(EngagementOutcome);
  if (!validOutcomes.includes(outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${validOutcomes.join(", ")}` },
      { status: 400 }
    );
  }

  const warnings: string[] = [];
  if (outcome === EngagementOutcome.LOST && !lossReason) {
    warnings.push("lossReason is recommended when outcome is LOST");
  }

  const updated = await prisma.engagement.update({
    where: { id },
    data: {
      outcome,
      ...(lossReason !== undefined && { lossReason }),
      ...(lossReasonDetail !== undefined && { lossReasonDetail }),
      ...(winFactors !== undefined && { winFactors }),
      ...(competitorWhoWon !== undefined && { competitorWhoWon }),
      ...(actualContractValue !== undefined && { actualContractValue }),
      ...(outcomeFeedback !== undefined && { outcomeFeedback }),
      outcomeRecordedAt: new Date(),
      outcomeRecordedBy: session.user.id,
    },
  });

  return NextResponse.json({ ...updated, warnings });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
