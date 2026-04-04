import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Stub: emit a few mock events then close
      // TODO: replace with real BullMQ job progress subscription
      send("connected", { phaseId: id, message: "SSE stream connected" });

      await new Promise((resolve) => setTimeout(resolve, 100));
      send("progress", { phaseId: id, step: "initializing", percent: 0 });

      await new Promise((resolve) => setTimeout(resolve, 100));
      send("progress", { phaseId: id, step: "running", percent: 50 });

      await new Promise((resolve) => setTimeout(resolve, 100));
      send("done", { phaseId: id, message: "Phase stub complete" });

      controller.close();
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
