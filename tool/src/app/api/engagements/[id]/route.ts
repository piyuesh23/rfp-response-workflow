import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { getEngagementAccess, requireEngagementEdit } from "@/lib/engagement-access";
import { enqueueIndexStructuredRow } from "@/lib/rag/enqueue";
import type { EngagementStatus, RfpSource, EngagementOutcome } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// Non-fatal ENGAGEMENT_META indexing helper. engagementId=null so admin chat
// can search globally. A failed index must NEVER fail the parent mutation.
async function indexEngagementMeta(engagement: {
  id: string;
  clientName: string;
  projectName: string | null;
  techStack: string;
  engagementType: string;
  status: string;
  estimatedDealValue: number | null;
  rfpSource: string | null;
  outcome: string | null;
  accountId: string | null;
}): Promise<void> {
  const deal = engagement.estimatedDealValue != null ? `$${engagement.estimatedDealValue}` : "—";
  const rfp = engagement.rfpSource ?? "—";
  const outcome = engagement.outcome ?? "pending";
  const summary = `${engagement.clientName} / ${engagement.projectName ?? "—"} (${engagement.techStack}, ${engagement.engagementType}, ${engagement.status}). Deal: ${deal}. RFP source: ${rfp}. Outcome: ${outcome}.`;
  if (summary.trim().length < 50) return;
  await enqueueIndexStructuredRow({
    // engagementId omitted → stored as NULL so admin chat can retrieve globally.
    sourceType: "ENGAGEMENT_META",
    sourceId: engagement.id,
    summary,
    metadata: {
      clientName: engagement.clientName,
      outcome: engagement.outcome,
      accountId: engagement.accountId,
    },
  });
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

    const engagement = await prisma.engagement.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, canonicalName: true, industry: true } },
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

    return NextResponse.json({ ...engagement, effectiveAccess: access });
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

  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  await requireEngagementEdit(session, id);

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
    estimatedBudget,
    financialProposalValue,
    outcome,
    lossReason,
    actualContractValue,
    competitorWhoWon,
    presalesHoursSpent,
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
    estimatedBudget?: number | null;
    financialProposalValue?: number | null;
    outcome?: EngagementOutcome | null;
    lossReason?: string | null;
    actualContractValue?: number | null;
    competitorWhoWon?: string | null;
    presalesHoursSpent?: number | null;
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
      ...(estimatedBudget !== undefined && { estimatedBudget }),
      ...(financialProposalValue !== undefined && { financialProposalValue }),
      ...(outcome !== undefined && { outcome }),
      ...(lossReason !== undefined && { lossReason }),
      ...(actualContractValue !== undefined && { actualContractValue }),
      ...(competitorWhoWon !== undefined && { competitorWhoWon }),
      ...(presalesHoursSpent !== undefined && { presalesHoursSpent }),
    } as Prisma.EngagementUncheckedUpdateInput,
  });

  // RAG indexing for ENGAGEMENT_META (non-fatal).
  await indexEngagementMeta({
    id: updated.id,
    clientName: updated.clientName,
    projectName: updated.projectName,
    techStack: updated.techStack,
    engagementType: updated.engagementType,
    status: updated.status,
    estimatedDealValue: updated.estimatedDealValue ?? null,
    rfpSource: updated.rfpSource ?? null,
    outcome: updated.outcome ?? null,
    accountId: updated.accountId ?? null,
  });

  return NextResponse.json(updated);
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
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

    await prisma.importItem.deleteMany({ where: { engagementId: id } });
    await prisma.engagement.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
