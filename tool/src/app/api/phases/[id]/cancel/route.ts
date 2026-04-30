import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import { requireEngagementEdit } from "@/lib/engagement-access";
import { getPhaseQueue } from "@/lib/queue";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const phase = await prisma.phase.findUnique({
      where: { id },
      include: { engagement: { select: { id: true } } },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    await requireEngagementEdit(session, phase.engagement.id);

    if (phase.status !== "RUNNING") {
      return NextResponse.json(
        { error: `Phase is not running (status: ${phase.status})` },
        { status: 409 }
      );
    }

    // Mark phase as FAILED immediately so the UI reflects cancellation.
    // The worker detects this before writing REVIEW and exits cleanly.
    await prisma.phase.update({
      where: { id },
      data: { status: "FAILED", completedAt: new Date() },
    });

    // Best-effort: remove the job if it hasn't started yet (waiting/delayed state).
    // Active jobs cannot be forcibly removed from outside; the worker guard handles those.
    try {
      const queue = getPhaseQueue();
      const waitingJobs = await queue.getJobs(["waiting", "delayed", "prioritized"]);
      for (const job of waitingJobs) {
        if (job.data.phaseId === id) {
          await job.remove();
          break;
        }
      }
    } catch {
      // Queue cleanup failure is non-fatal — DB state is the source of truth.
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, message } = guardErrorStatus(err);
    return NextResponse.json({ error: message }, { status });
  }
}
