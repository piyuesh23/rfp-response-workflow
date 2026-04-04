import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { feedback } = await req.json();

  if (!feedback || typeof feedback !== "string" || feedback.trim().length < 10) {
    return NextResponse.json(
      { error: "Feedback must be at least 10 characters" },
      { status: 400 }
    );
  }

  const phase = await prisma.phase.findUnique({ where: { id } });

  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 });
  }

  if (phase.status !== "REVIEW") {
    return NextResponse.json(
      { error: "Phase must be in REVIEW status to request revision" },
      { status: 409 }
    );
  }

  const updated = await prisma.phase.update({
    where: { id },
    data: {
      status: "PENDING",
      completedAt: null,
      // Store revision feedback in agentSessionId field as JSON metadata
      // In a production system, this would be a separate revisionNotes table
      agentSessionId: JSON.stringify({
        previousSessionId: phase.agentSessionId,
        revisionFeedback: feedback.trim(),
        requestedAt: new Date().toISOString(),
      }),
    },
  });

  return NextResponse.json({ phase: updated, revisionRequested: true });
}
