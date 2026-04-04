import { NextRequest, NextResponse } from "next/server";
import { QueueEvents } from "bullmq";
import { redisConnection } from "@/lib/queue";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: phaseId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller may be closed
        }
      }

      send("connected", { phaseId, message: "SSE stream connected" });

      // Look up the BullMQ job ID for this phase
      const jobId = `phase-${phaseId}`;

      let queueEvents: QueueEvents | null = null;
      try {
        queueEvents = new QueueEvents("phase-execution", {
          connection: redisConnection,
        });

        await queueEvents.waitUntilReady();

        const onProgress = ({
          jobId: eventJobId,
          data,
        }: {
          jobId: string;
          data: unknown;
        }) => {
          if (eventJobId !== jobId) return;

          const progressData = data as {
            type?: string;
            tool?: string;
            message?: string;
          };

          send("progress", {
            phaseId,
            tool: progressData?.tool,
            message: progressData?.message ?? "Processing...",
          });
        };

        const onCompleted = async ({
          jobId: eventJobId,
        }: {
          jobId: string;
        }) => {
          if (eventJobId !== jobId) return;

          send("done", { phaseId, message: "Phase completed" });

          cleanup();
        };

        const onFailed = async ({
          jobId: eventJobId,
          failedReason,
        }: {
          jobId: string;
          failedReason: string;
        }) => {
          if (eventJobId !== jobId) return;

          send("error", {
            phaseId,
            message: failedReason || "Phase failed",
          });

          cleanup();
        };

        function cleanup() {
          if (queueEvents) {
            queueEvents.off("progress", onProgress);
            queueEvents.off("completed", onCompleted);
            queueEvents.off("failed", onFailed);
            queueEvents.close().catch(() => {});
            queueEvents = null;
          }
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }

        queueEvents.on("progress", onProgress);
        queueEvents.on("completed", onCompleted);
        queueEvents.on("failed", onFailed);

        // Check if the phase is already completed/failed (race condition guard)
        const phase = await prisma.phase.findUnique({
          where: { id: phaseId },
          select: { status: true },
        });

        if (
          phase &&
          phase.status !== "RUNNING" &&
          phase.status !== "PENDING"
        ) {
          send("done", {
            phaseId,
            message: `Phase already in ${phase.status} state`,
          });
          cleanup();
          return;
        }

        // Auto-close after 10 minutes to prevent hung connections
        setTimeout(() => {
          send("timeout", {
            phaseId,
            message: "SSE connection timed out after 10 minutes",
          });
          cleanup();
        }, 600_000);
      } catch (err) {
        send("error", {
          phaseId,
          message: `SSE setup error: ${err instanceof Error ? err.message : String(err)}`,
        });
        if (queueEvents) {
          queueEvents.close().catch(() => {});
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
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
