import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPresignedUrl } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const artefact = await prisma.phaseArtefact.findUnique({
    where: { id },
    include: {
      phase: {
        include: {
          engagement: { select: { createdById: true } },
        },
      },
    },
  });

  if (!artefact) {
    return NextResponse.json({ error: "Artefact not found" }, { status: 404 });
  }

  if (artefact.phase.engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (artefact.contentMd) {
    return NextResponse.json({
      id: artefact.id,
      artefactType: artefact.artefactType,
      version: artefact.version,
      contentMd: artefact.contentMd,
      metadata: artefact.metadata,
      createdAt: artefact.createdAt,
    });
  }

  if (artefact.fileUrl) {
    const presignedUrl = await getPresignedUrl(artefact.fileUrl);
    return NextResponse.json({
      id: artefact.id,
      artefactType: artefact.artefactType,
      version: artefact.version,
      fileUrl: presignedUrl,
      metadata: artefact.metadata,
      createdAt: artefact.createdAt,
    });
  }

  return NextResponse.json({
    id: artefact.id,
    artefactType: artefact.artefactType,
    version: artefact.version,
    contentMd: null,
    fileUrl: null,
    metadata: artefact.metadata,
    createdAt: artefact.createdAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const artefact = await prisma.phaseArtefact.findUnique({
    where: { id },
    include: {
      phase: {
        include: {
          engagement: { select: { createdById: true } },
        },
      },
    },
  });

  if (!artefact) {
    return NextResponse.json({ error: "Artefact not found" }, { status: 404 });
  }

  if (artefact.phase.engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { contentMd } = body as { contentMd: string };

  if (typeof contentMd !== "string") {
    return NextResponse.json(
      { error: "contentMd must be a string" },
      { status: 400 }
    );
  }

  const updated = await prisma.phaseArtefact.update({
    where: { id },
    data: { contentMd },
  });

  return NextResponse.json(updated);
}
