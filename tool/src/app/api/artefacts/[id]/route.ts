import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { downloadFile } from "@/lib/storage";

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
    try {
      const buffer = await downloadFile(artefact.fileUrl);
      const filename = artefact.fileUrl.split("/").pop() ?? "download";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const contentTypeMap: Record<string, string> = {
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentTypeMap[ext] ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(buffer.length),
        },
      });
    } catch {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      );
    }
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
