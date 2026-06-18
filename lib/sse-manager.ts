type SSEController = ReadableStreamDefaultController<Uint8Array>

// Store on globalThis so the Set survives Next.js Hot Module Replacement.
// Without this, every file save in dev resets the module and drops all connections.
declare global {
  // eslint-disable-next-line no-var
  var _sseConnections: Set<SSEController> | undefined
}

if (!globalThis._sseConnections) {
  globalThis._sseConnections = new Set<SSEController>()
}

const connections = globalThis._sseConnections

export function addConnection(controller: SSEController) {
  connections.add(controller)
}

export function removeConnection(controller: SSEController) {
  connections.delete(controller)
}

export function broadcastUpdate(apartados: string[]) {
  if (connections.size === 0) return
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify({ apartados })}\n\n`
  const bytes = encoder.encode(message)
  for (const controller of connections) {
    try {
      controller.enqueue(bytes)
    } catch {
      connections.delete(controller)
    }
  }
}

export function broadcastForceLogout(userIds: string[]) {
  if (connections.size === 0 || userIds.length === 0) return
  const encoder = new TextEncoder()
  const message = `data: ${JSON.stringify({ forceLogout: userIds })}\n\n`
  const bytes = encoder.encode(message)
  for (const controller of connections) {
    try {
      controller.enqueue(bytes)
    } catch {
      connections.delete(controller)
    }
  }
}
