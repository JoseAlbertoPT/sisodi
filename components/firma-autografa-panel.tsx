"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, CheckCircle2, Loader2, FileText, AlertCircle } from "lucide-react"

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
                <div className="flex items-center gap-2 rounded-md border border-secondary/30 bg-secondary/5 p-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <span className="flex-1 truncate">{firma?.archivo_firmado?.split("/").pop()}</span>
                  <a href={firma?.archivo_firmado ?? "#"} target="_blank" rel="noopener" className="text-xs text-secondary hover:underline">Ver</a>
                </div>
              )}
              <label className={`flex flex-col items-center gap-2 rounded-[12px] border-2 border-dashed cursor-pointer transition-colors px-4 py-5 text-center
                ${uploading ? "border-[#ddd] bg-[#f0f0f0] cursor-not-allowed" : error ? "border-[#D32F2F] bg-[#FFF5F5]" : "border-[#ccc] bg-[#fafafa] hover:border-[#7B2D5E] hover:bg-[#f5f5f5]"}`}>
                <input
                  type="file" accept="application/pdf" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                    e.target.value = ""
                  }}
                  disabled={uploading}
                />
                {uploading
                  ? <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
                  : <Upload className={`h-7 w-7 ${error ? "text-[#D32F2F]" : "text-muted-foreground"}`} />}
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-muted-foreground">
                    {uploading ? "Subiendo archivo..." : "Arrastra tu PDF aquí, o"}
                  </p>
                  {!uploading && (
                    <span className="text-sm font-medium text-[#7B2D5E] underline underline-offset-2">
                      {archivoSubido ? "Reemplazar archivo" : "Seleccionar PDF"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Solo PDF · máx. 10 MB</p>
              </label>
              {error && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: "#D32F2F" }}>
                  <span className="shrink-0 text-base leading-none">⊘</span>{error}
                </p>
              )}
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
