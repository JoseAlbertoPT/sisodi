"use client"

import { useEffect, useRef } from "react"

// Una sola acción del usuario (crear solicitud + subir adjuntos + cambiar de
// estado) dispara varios broadcasts seguidos (ver broadcastUpdate en
// lib/sse-manager.ts). Sin agrupar, cada pestaña abierta de cada usuario
// conectado repetiría su refetch pesado una vez por broadcast; agrupamos los
// que lleguen dentro de esta ventana en un solo refetch.
const DEBOUNCE_MS = 800

// Cada llamada a useRealtime() solía abrir su propia conexión EventSource a
// /api/events. Como varios componentes están montados a la vez (sidebar,
// calendario, tabulador, la página activa...), eso podía abrir 4-6+ conexiones
// persistentes simultáneas hacia el mismo origen — y los navegadores limitan
// a 6 conexiones concurrentes por origen en HTTP/1.1 (lo que usa `next dev`).
// Al llegar a ese límite, CUALQUIER petición nueva (incluido un POST para
// crear una solicitud) se queda en cola esperando un socket libre
// indefinidamente, sin llegar siquiera al servidor. Por eso ahora se comparte
// una sola conexión EventSource para toda la app, con conteo de referencias.
type Subscriber = {
  apartados: string[]
  onUpdate: () => void
  debounceTimer: ReturnType<typeof setTimeout> | null
}

let sharedEs: EventSource | null = null
let sharedPollTimer: ReturnType<typeof setInterval> | null = null
const subscribers = new Set<Subscriber>()

function ensureSharedConnection() {
  if (sharedEs) return

  const es = new EventSource("/api/events")
  sharedEs = es

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as { apartados?: string[] }
      if (!data.apartados) return
      for (const sub of subscribers) {
        if (data.apartados.some((a) => sub.apartados.includes(a))) {
          if (sub.debounceTimer) clearTimeout(sub.debounceTimer)
          sub.debounceTimer = setTimeout(() => {
            sub.debounceTimer = null
            sub.onUpdate()
          }, DEBOUNCE_MS)
        }
      }
    } catch {}
  }

  // When the connection drops and re-establishes, reload immediately to
  // catch any broadcasts that were missed during the disconnected window.
  es.onerror = () => {
    if (es.readyState === EventSource.CONNECTING) {
      es.addEventListener("open", () => {
        for (const sub of subscribers) sub.onUpdate()
      }, { once: true })
    }
  }

  // Polling fallback: reload every 45 s in case an SSE event was missed
  // (e.g. network hiccup, proxy restart).
  sharedPollTimer = setInterval(() => {
    for (const sub of subscribers) sub.onUpdate()
  }, 45_000)
}

function teardownSharedConnectionIfUnused() {
  if (subscribers.size > 0) return
  sharedEs?.close()
  sharedEs = null
  if (sharedPollTimer) clearInterval(sharedPollTimer)
  sharedPollTimer = null
}

export function useRealtime(apartados: string[], onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    const sub: Subscriber = { apartados, onUpdate: () => onUpdateRef.current(), debounceTimer: null }
    subscribers.add(sub)
    ensureSharedConnection()

    return () => {
      subscribers.delete(sub)
      if (sub.debounceTimer) clearTimeout(sub.debounceTimer)
      teardownSharedConnectionIfUnused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
