import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { copyMasterTemplate } from "@/lib/template-populator";
import type { TechStack, EngagementType } from "@/generated/prisma/enums";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const engagements = await prisma.engagement.findMany({
    where: { createdById: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { phases: true } },
      phases: {
        select: { phaseNumber: true, status: true },
      },
    },
  });

  return NextResponse.json(engagements);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { clientName, projectName, techStack, engagementType } = body as {
    clientName: string;
    projectName?: string;
    techStack: TechStack;
    engagementType?: EngagementType;
  };

  if (!clientName || !techStack) {
    return NextResponse.json(
      { error: "clientName and techStack are required" },
      { status: 400 }
    );
  }

  const phaseNumbers = ["0", "1", "1A", "2", "3", "4", "5"];

  const engagement = await prisma.engagement.create({
    data: {
      clientName,
      projectName: projectName ?? null,
      techStack,
      engagementType: engagementType ?? "NEW_BUILD",
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

  return NextResponse.json(engagement, { status: 201 });
}
