import { NextRequest } from "next/server";
import { RealtimeEvents } from "@/lib/aws/dynamodb";
import { verifySession } from "@/lib/aws/auth";

// Server-Sent Events (SSE) endpoint for real-time Admin POS updates.
// Branch-aware: a branch-scoped session only receives events for their branch.
// Super admin receives all events (no branch filter).
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  // Determine branch filter from session
  let branchFilter: string | undefined = undefined;
  try {
    const { authenticated, user } = await verifySession();
    if (authenticated && user && user.role !== "super_admin") {
      branchFilter = user.branch_id as string | undefined;
    }
  } catch {
    // Non-authenticated SSE connections still work (for backward compat with public displays)
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection heartbeat
      controller.enqueue(encoder.encode("event: connected\ndata: {\"status\":\"connected\"}\n\n"));

      // Subscribe with optional branch filter
      const unsubscribe = RealtimeEvents.subscribe((event) => {
        try {
          const payload = JSON.stringify({ type: event.type, ...(event.data || {}) });
          // Named event for addEventListener('<event_type>', ...)
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${payload}\n\n`));
          // Default message for onmessage handler
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Client disconnected, silently ignore
        }
      }, branchFilter);

      // Send periodic heartbeats to keep the connection alive (every 30s)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on client disconnect
      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeatInterval);
      };

      (controller as any)._cleanup = cleanup;
    },

    cancel() {
      if ((this as any)._cleanup) {
        (this as any)._cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
