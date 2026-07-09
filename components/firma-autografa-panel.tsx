"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, Loader2, AlertCircle, X } from "lucide-react"
import { FileDropZone, FileTypeIcon } from "@/components/ui/file-drop-zone"

interface FirmaProceso {
  id: number
  solicitud_id: number
  tipo: string
  archivo_firmado: string | null
  estado: string
  fecha_completado: string | null
}

interface Props {
  solicitudId: number
  folioJustificacion: string
  currentUserId: string
  onGenerarPdf: () => Promise<void> | void
  onFinalizar: () => Promise<void> | void
  guardandoFinal: boolean
}

export function FirmaAutografaPanel({
  solicitudId,
  folioJustificacion,
  currentUserId,
  onGenerarPdf,
  onFinalizar,
  guardandoFinal,
}: Props) {
  const [firma, setFirma] = useState<FirmaProceso | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/firma-efirma/estado?solicitudId=${solicitudId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setFirma(json.firma)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [solicitudId])

  useEffect(() => { cargar() }, [cargar])

  const handleUpload = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("solicitudId", String(solicitudId))
      fd.append("creadoPorId", currentUserId)
      const res = await fetch("/api/firma-efirma/autografa/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al subir"); return }
      await cargar()
    } catch {
      setError("Error de conexión al subir")
    } finally {
      setUploading(false)
    }
  }

  const handleClear = async () => {
    setClearing(true); setError(null)
    try {
      const res = await fetch("/api/firma-efirma/autografa/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al quitar el archivo"); return }
      await cargar()
    } catch {
      setError("Error de conexión")
    } finally {
      setClearing(false)
    }
  }

  const archivoSubido = Boolean(firma?.archivo_firmado)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Esta justificación se firmará de forma <span className="font-semibold text-card-foreground">autógrafa</span>.
          Descarga el PDF, recolecta las firmas manuscritas y vuelve a subirlo escaneado.
        </p>
      </div>

      <Card className="border-border py-4 gap-3">
        <CardHeader className="px-5 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-secondary" /> Paso 1 — Descargar justificación
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-1 pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onGenerarPdf()}
            className="gap-1.5"
          >
            Descargar PDF ({folioJustificacion})
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border py-4 gap-3">
        <CardHeader className="px-5 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-secondary" /> Paso 2 — Subir PDF firmado
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-1 pt-0 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <>
              {archivoSubido && (
                <div className="flex items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-2">
                  <FileTypeIcon name={firma?.archivo_firmado?.split("/").pop() ?? "archivo.pdf"} size="sm" />
                  <span className="flex-1 truncate text-sm text-[#374151]">{firma?.archivo_firmado?.split("/").pop()}</span>
                  <a href={firma?.archivo_firmado ?? "#"} target="_blank" rel="noopener" className="text-xs text-[#7B2D5E] hover:underline shrink-0">Ver</a>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={clearing}
                    aria-label="Quitar archivo"
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              <FileDropZone
                accept="application/pdf"
                hint="Solo PDF · máx. 10 MB"
                selectLabel={archivoSubido ? "Reemplazar archivo" : "Seleccionar PDF"}
                multiple={false}
                files={[]}
                onFilesChange={(fs) => { if (fs[0]) handleUpload(fs[0]) }}
                disabled={uploading}
                loading={uploading}
                loadingText="Subiendo archivo..."
                error={error}
                compact
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end px-6 py-4 border-t border-[#E5E7EB]">
        <Button
          onClick={() => onFinalizar()}
          disabled={!archivoSubido || guardandoFinal}
          className="gap-1.5 px-5 py-2"
          style={{ backgroundColor: "#773357", color: "#fff", border: "none" }}
        >
          {guardandoFinal ? "Enviando..." : "Enviar a Emisor"}
        </Button>
      </div>
    </div>
  )
}
