import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { copyMasterTemplate } from "@/lib/template-populator";
import { enqueueIndexStructuredRow } from "@/lib/rag/enqueue";
import type { TechStack, EngagementType } from "@/generated/prisma/enums";

// Non-fatal ENGAGEMENT_META indexing helper. Indexed with engagementId=null so
// admin-scope chat can answer cross-engagement queries (e.g. "which engagements
// are WON"). A failed index must NEVER fail the parent mutation.
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const engagements = await prisma.engagement.findMany({
    where: isAdmin ? {} : { createdById: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { phases: true } },
      phases: {
        select: { phaseNumber: true, status: true },
      },
    },
  });

  // Aggregate cost/token data per engagement in a single query
  const costByEngagement = await prisma.phaseExecution.groupBy({
    by: ["engagementId"],
    where: { engagementId: { in: engagements.map((e) => e.id) } },
    _sum: { totalTokens: true, estimatedCostUsd: true },
    _count: { id: true },
  });
  const costMap = new Map(
    costByEngagement.map((r) => [
      r.engagementId,
      {
        totalTokens: r._sum.totalTokens ?? 0,
        estimatedCostUsd: r._sum.estimatedCostUsd ?? 0,
        phasesRun: r._count.id,
      },
    ])
  );

  return NextResponse.json(
    engagements.map((e) => ({
      ...e,
      costSummary: costMap.get(e.id) ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    clientName,
    projectName,
    techStack,
    techStackCustom,
    techStackIsCustom,
    engagementType,
    projectDescription,
    legacyPlatform,
    legacyPlatformUrl,
    accountId,
  } = body as {
    clientName: string;
    projectName?: string;
    techStack: TechStack;
    techStackCustom?: string;
    techStackIsCustom?: boolean;
    engagementType?: EngagementType;
    projectDescription?: string;
    legacyPlatform?: string;
    legacyPlatformUrl?: string;
    accountId?: string;
  };

  if (!clientName || !techStack) {
    return NextResponse.json(
      { error: "clientName and techStack are required" },
      { status: 400 }
    );
  }

  if (techStack === "OTHER" && (!techStackCustom || techStackCustom.trim().length < 10)) {
    return NextResponse.json(
      { error: "techStackCustom is required (≥10 chars) when techStack is OTHER" },
      { status: 400 }
    );
  }

  const phaseNumbers = ["0", "1", "1A", "2", "3", "4", "5"];

  const engagement = await prisma.engagement.create({
    data: {
      clientName,
      projectName: projectName ?? null,
      techStack,
      techStackCustom: techStackCustom?.trim() || null,
      techStackIsCustom: Boolean(techStackIsCustom) || techStack === "OTHER",
      engagementType: engagementType ?? "NEW_BUILD",
      projectDescription: projectDescription?.trim() || null,
      legacyPlatform: legacyPlatform?.trim() || null,
      legacyPlatformUrl: legacyPlatformUrl?.trim() || null,
      accountId: accountId ?? null,
      createdById: session.user.id,
      phases: {
        create: phaseNumbers.map((phaseNumber) => ({
          phaseNumber,
          status: "PENDING",
        })),
      },
    },
    include: {
      phases: { orderBy: { phaseNumber: "asc" } },
    },
  });

  // Copy the Master Estimate Template to the engagement's S3 folder
  try {
    const templateKey = await copyMasterTemplate(engagement.id);
    await prisma.engagement.update({
      where: { id: engagement.id },
      data: {
        templateFileUrl: templateKey,
        templateStatus: {},
      },
    });
  } catch {
    // Template copy failure is non-fatal - engagement is still usable
  }

  // RAG indexing for ENGAGEMENT_META (non-fatal).
  await indexEngagementMeta({
    id: engagement.id,
    clientName: engagement.clientName,
    projectName: engagement.projectName,
    techStack: engagement.techStack,
    engagementType: engagement.engagementType,
    status: engagement.status,
    estimatedDealValue: engagement.estimatedDealValue ?? null,
    rfpSource: engagement.rfpSource ?? null,
    outcome: engagement.outcome ?? null,
    accountId: engagement.accountId ?? null,
  });

  return NextResponse.json(engagement, { status: 201 });
}
