"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, CheckCircle2, Loader2, FileText, AlertCircle } from "lucide-react"
import { FileDropZone } from "@/components/ui/file-drop-zone"

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

  const archivoSubido = Boolean(firma?.archivo_firmado)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Esta justificación se firmará de forma <span className="font-semibold text-card-foreground">autógrafa</span>.
          Descarga el PDF, recolecta las firmas manuscritas y vuelve a subirlo escaneado.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-secondary" /> Paso 1 — Descargar justificación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => onGenerarPdf()} className="gap-1.5">
            <Download className="h-4 w-4" /> Descargar PDF ({folioJustificacion})
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-secondary" /> Paso 2 — Subir PDF firmado
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <>
              {archivoSubido && (
                <div className="flex items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="flex-1 truncate text-sm text-[#374151]">{firma?.archivo_firmado?.split("/").pop()}</span>
                  <a href={firma?.archivo_firmado ?? "#"} target="_blank" rel="noopener" className="text-xs text-[#7B2D5E] hover:underline shrink-0">Ver</a>
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
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => onFinalizar()}
          disabled={!archivoSubido || guardandoFinal}
          className="gap-1.5"
        >
          {guardandoFinal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Enviar a Emisor
        </Button>
      </div>
    </div>
  )
}
