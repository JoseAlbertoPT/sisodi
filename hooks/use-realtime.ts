"use client"

import { useEffect, useRef } from "react"

export function useRealtime(apartados: string[], onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    const es = new EventSource("/api/events")

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { apartados?: string[] }
        if (data.apartados?.some((a) => apartados.includes(a))) {
          onUpdateRef.current()
        }
      } catch {}
    }

    // When the connection drops and re-establishes, reload immediately to
    // catch any broadcasts that were missed during the disconnected window.
    es.onerror = () => {
      if (es.readyState === EventSource.CONNECTING) {
        es.addEventListener("open", () => onUpdateRef.current(), { once: true })
      }
    }

    // Polling fallback: reload every 45 s in case an SSE event was missed
    // (e.g. network hiccup, proxy restart). Only one page is mounted at a
    // time in this SPA, so this is at most one request per 45 s.
    const pollTimer = setInterval(() => onUpdateRef.current(), 45_000)

    return () => {
      es.close()
      clearInterval(pollTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
