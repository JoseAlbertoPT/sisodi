"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Stamp, Download, Upload, CheckCircle2, Loader2, AlertCircle, FileText, RefreshCw,
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
  const inputRef = useRef<HTMLInputElement>(null)

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
      // ignore
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
      if (inputRef.current) inputRef.current.value = ""
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

            {/* Paso 1: Descargar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={sellado ? "outline" : "default"}
                size="sm"
                onClick={handleDescargar}
                disabled={descargando}
                className={`gap-1.5 ${!sellado ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
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

            {/* Paso 2: Subir sellado */}
            <div className={`flex flex-col gap-2 rounded-md border ${habilitarSubida ? "border-border" : "border-dashed border-muted-foreground/30 bg-muted/20"} p-3`}>
              <div className="flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{labelSubir}</span>
                {!habilitarSubida && (
                  <Badge variant="outline" className="text-[10px] ml-auto">Descarga primero</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={!habilitarSubida || subiendo}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleSubir(f)
                  }}
                  className="text-xs"
                />
                {sellado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEliminar}
                    disabled={subiendo}
                    className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reemplazar
                  </Button>
                )}
              </div>
              {sellado && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{sellado.nombre_original ?? "documento.pdf"}</span>
                  <span>·</span>
                  <span>{fechaSubida}</span>
                  {sellado.uploader?.nombre && (
                    <>
                      <span>·</span>
                      <span>por {sellado.uploader.nombre}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
