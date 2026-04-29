"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { Loader2 } from "lucide-react"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PdfPreviewProps {
  fileUrl: string | null
  label?: string
  refreshing?: boolean
}

export function PdfPreview({ fileUrl, label, refreshing }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [docReady, setDocReady] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setPageWidth(w - 16)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setDocReady(false)
    setNumPages(0)
  }, [fileUrl])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-y-auto bg-muted rounded-md"
    >
      {fileUrl && pageWidth > 0 && (
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n)
            setDocReady(true)
          }}
          loading={null}
          error={
            <div className="flex items-center justify-center h-full p-4 text-sm text-destructive">
              No se pudo cargar el PDF
            </div>
          }
          className="flex flex-col items-center gap-3 py-3"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`page-${i + 1}`}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
              className="shadow-sm rounded-sm overflow-hidden bg-background"
            />
          ))}
        </Document>
      )}

      {(!fileUrl || !docReady) && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground bg-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{label ?? "Cargando vista previa…"}</span>
        </div>
      )}

      {refreshing && fileUrl && docReady && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm border border-border">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualizando…
        </div>
      )}
    </div>
  )
}
