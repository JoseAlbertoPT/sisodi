"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileDropZone, FileTypeIcon } from "@/components/ui/file-drop-zone"
import {
  Stamp, Download, Upload, CheckCircle2, Loader2, AlertCircle, X,
} from "lucide-react"

export type SelladoEtapa = "uefa" | "emision"

interface SelladoData {
  id: number
  solicitud_id: number
  etapa: SelladoEtapa
  archivo: string
  nombre_original: string | null
  uploaded_by: string | null
  uploaded_at: string
  uploader?: { id: string; nombre: string } | null
}

interface Props {
  solicitudId: number
  etapa: SelladoEtapa
  /** Trae el PDF (con firmas/constancia, o el dictamen) y lo entrega como Blob para descarga. */
  onDescargar: () => Promise<Blob>
  /** Se llama al cambiar el estado del sellado (subido o eliminado). */
  onCambio?: (selladoSubido: boolean) => void
  usuarioId?: string | null
  /** Nombre sugerido para la descarga. */
  nombreDescarga?: string
  className?: string
}

export function SelladoDocumentoSection({
  solicitudId, etapa, onDescargar, onCambio,
  usuarioId, nombreDescarga, className,
}: Props) {
  const [sellado, setSellado] = useState<SelladoData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState(false)
  const [descargado, setDescargado] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titulo = etapa === "emision" ? "Sellado del dictamen" : "Sellado del documento firmado"
  const labelDescargar = etapa === "emision" ? "Descargar dictamen para sellar" : "Descargar para sellar"
  const labelSubir = etapa === "emision" ? "Subir dictamen sellado" : "Subir documento sellado"

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/documento-sellado?solicitudId=${solicitudId}&etapa=${etapa}`)
      const json = await res.json()
      if (res.ok && json.ok) {
        setSellado(json.sellado ?? null)
      }
    } catch {
    } finally {
      setCargando(false)
    }
  }, [solicitudId, etapa])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    onCambio?.(!!sellado)
  }, [sellado, onCambio])

  const handleDescargar = async () => {
    setDescargando(true); setError(null)
    try {
      const blob = await onDescargar()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${nombreDescarga ?? `documento_${solicitudId}`}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDescargado(true)
    } catch (e: any) {
      setError(e?.message ?? "No se pudo descargar")
    } finally {
      setDescargando(false)
    }
  }

  const handleSubir = async (file: File) => {
    setSubiendo(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("solicitudId", String(solicitudId))
      fd.append("etapa", etapa)
      if (usuarioId) fd.append("usuarioId", usuarioId)
      const res = await fetch("/api/documento-sellado", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Error al subir")
        return
      }
      setSellado(json.sellado)
    } catch {
      setError("Error de conexión al subir")
    } finally {
      setSubiendo(false)
    }
  }

  const handleEliminar = async () => {
    setSubiendo(true); setError(null)
    try {
      const res = await fetch(`/api/documento-sellado?solicitudId=${solicitudId}&etapa=${etapa}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo eliminar")
        return
      }
      setSellado(null)
      setDescargado(false)
    } catch {
      setError("Error de conexión")
    } finally {
      setSubiendo(false)
    }
  }

  const fechaSubida = sellado
    ? new Date(sellado.uploaded_at).toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null

  const habilitarSubida = descargado || !!sellado

  return (
    <Card className={`shadow-sm border-2 ${sellado ? "border-secondary/40 bg-secondary/[0.04]" : "border-accent/40 bg-accent/[0.04]"} ${className ?? ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Stamp className={`h-4 w-4 ${sellado ? "text-secondary" : "text-accent-foreground"}`} />
          {titulo}
          {sellado && (
            <Badge className="bg-secondary/15 text-secondary border-0 text-[10px] gap-1 ml-1">
              <CheckCircle2 className="h-3 w-3" /> Subido
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cargando ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sellado
                ? "El documento sellado fue subido correctamente. Si necesita reemplazarlo, descargue de nuevo y suba la versión actualizada."
                : "Descargue el documento, agréguele el sello institucional fuera del sistema y vuelva a subirlo aquí. Hasta entonces no podrá continuar."}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={handleDescargar}
                disabled={descargando}
                className="gap-1.5"
                style={sellado
                  ? { backgroundColor: "#fff", color: "#773357", border: "1.5px solid #773357" }
                  : { backgroundColor: "#773357", color: "#fff", border: "none" }}
              >
                {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {labelDescargar}
              </Button>
              {(descargado || sellado) && (
                <span className="inline-flex items-center gap-1 text-[11px] text-secondary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Descarga lista
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Upload className={`h-3.5 w-3.5 ${habilitarSubida ? "text-muted-foreground" : "text-[#aaa]"}`} />
                <span className={`text-xs font-medium ${!habilitarSubida ? "text-[#aaa]" : ""}`}>{labelSubir}</span>
                {!habilitarSubida && (
                  <Badge variant="outline" className="text-[10px] ml-auto">Descarga primero</Badge>
                )}
              </div>

              {sellado ? (
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                    <FileTypeIcon name={sellado.nombre_original ?? "documento.pdf"} size="sm" />
                  </div>
                  <div className="flex flex-1 min-w-0 flex-col">
                    <span className="truncate text-sm font-medium leading-snug text-gray-800">
                      {sellado.nombre_original ?? "documento.pdf"}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-400">
                      {fechaSubida}{sellado.uploader?.nombre ? ` · por ${sellado.uploader.nombre}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={subiendo}
                    aria-label="Quitar archivo"
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : null}
              {sellado && error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              )}
              {!sellado && (
                <FileDropZone
                  accept="application/pdf,.pdf"
                  hint="Solo PDF"
                  selectLabel="Seleccionar PDF"
                  multiple={false}
                  files={[]}
                  onFilesChange={(fs) => { if (fs[0]) handleSubir(fs[0]) }}
                  disabled={!habilitarSubida}
                  loading={subiendo}
                  loadingText="Subiendo archivo..."
                  error={error}
                  compact
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
