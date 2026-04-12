/**
 * GET /api/imports/[id]/progress
 * Server-Sent Events endpoint for real-time import job progress.
 * Polls the ImportJob every 2 seconds and streams status changes.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastProcessed = -1;

      const interval = setInterval(async () => {
        try {
          const job = await prisma.importJob.findUnique({
            where: { id },
            select: {
              status: true,
              totalFiles: true,
              processedFiles: true,
              confirmedFiles: true,
              skippedFiles: true,
            },
          });

          if (!job) {
            controller.close();
            clearInterval(interval);
            return;
          }

          // Only send if data changed
          if (job.processedFiles !== lastProcessed) {
            lastProcessed = job.processedFiles;
            const event = `data: ${JSON.stringify({
              type: "progress",
              status: job.status,
              processed: job.processedFiles,
              total: job.totalFiles,
              confirmed: job.confirmedFiles,
              skipped: job.skippedFiles,
            })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }

          // Close stream when job is done
          if (["REVIEW", "COMPLETED", "FAILED"].includes(job.status)) {
            const finalEvent = `data: ${JSON.stringify({
              type: "complete",
              status: job.status,
            })}\n\n`;
            controller.enqueue(encoder.encode(finalEvent));
            controller.close();
            clearInterval(interval);
          }
        } catch {
          controller.close();
          clearInterval(interval);
        }
      }, 2000);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
