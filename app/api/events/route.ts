import { type NextRequest } from "next/server"
import { addConnection, removeConnection } from "@/lib/sse-manager"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder()
  let ctrl: ReadableStreamDefaultController<Uint8Array>
  let heartbeatTimer: ReturnType<typeof setInterval>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
      addConnection(ctrl)
      c.enqueue(encoder.encode(": connected\n\n"))

      // Send a heartbeat every 20 s to keep the connection alive through
      // proxies / load-balancers that close idle streams.
      heartbeatTimer = setInterval(() => {
        try {
          c.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeatTimer)
          removeConnection(ctrl)
        }
      }, 20_000)
    },
    cancel() {
      clearInterval(heartbeatTimer)
      removeConnection(ctrl)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
