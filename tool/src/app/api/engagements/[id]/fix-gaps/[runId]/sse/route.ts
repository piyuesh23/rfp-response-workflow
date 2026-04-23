import { NextRequest, NextResponse } from "next/server";
import { QueueEvents } from "bullmq";
import { redisConnection } from "@/lib/queue";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed
        }
      }

      send("connected", { runId, message: "SSE stream connected" });

      const jobId = `fix-gaps-${runId}`;
      let queueEvents: QueueEvents | null = null;

      try {
        queueEvents = new QueueEvents("gap-fix", { connection: redisConnection });
        await queueEvents.waitUntilReady();

        function cleanup() {
          if (queueEvents) {
            queueEvents.removeAllListeners();
            queueEvents.close().catch(() => {});
            queueEvents = null;
          }
          try { controller.close(); } catch { /* already closed */ }
        }

        queueEvents.on("progress", ({ jobId: eid, data }: { jobId: string; data: unknown }) => {
          if (eid !== jobId) return;
          const d = data as { tool?: string; message?: string };
          send("progress", { runId, tool: d?.tool, message: d?.message ?? "Processing..." });
        });

        queueEvents.on("completed", ({ jobId: eid }: { jobId: string }) => {
          if (eid !== jobId) return;
          send("done", { runId, message: "Gap fix completed" });
          cleanup();
        });

        queueEvents.on("failed", ({ jobId: eid, failedReason }: { jobId: string; failedReason: string }) => {
          if (eid !== jobId) return;
          send("error", { runId, message: failedReason || "Gap fix failed" });
          cleanup();
        });

        // Race condition guard: check if already done
        const run = await prisma.gapFixRun.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (run && (run.status === "DONE" || run.status === "FAILED")) {
          send(run.status === "DONE" ? "done" : "error", {
            runId,
            message: `Run already in ${run.status} state`,
          });
          cleanup();
          return;
        }

        setTimeout(() => {
          send("timeout", { runId, message: "SSE connection timed out after 10 minutes" });
          cleanup();
        }, 600_000);
      } catch (err) {
        send("error", { runId, message: `SSE setup error: ${err instanceof Error ? err.message : String(err)}` });
        if (queueEvents) queueEvents.close().catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
