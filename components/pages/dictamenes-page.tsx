"use client"

import { normalizeText } from "@/lib/utils"
import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from "react"
import { useRealtime } from "@/hooks/use-realtime"
import dynamic from "next/dynamic"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import {
  Download, FileCheck, Stamp, Printer,
  Loader2, AlertTriangle, RefreshCw, MoreHorizontal, Eye,
} from "lucide-react"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageLayout } from "@/components/page-layout"

const PdfPreview = dynamic(() => import("@/components/pdf-preview").then((m) => m.PdfPreview), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground bg-muted rounded-md">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Cargando visor…</span>
    </div>
  ),
})
interface DictamenEmitido {
  id:             string
  folioDictamen:  string | null
  folioRecepcion: string | null
  fechaEmision:   string | null
  tipoFirma:      string | null
  archivoPdf:     string | null
  secretaria:     string
  tipoSolicitud:  string
  regimen:        string | null
  denominacion:   string | null
  importeBruto:   string | null
  vigenciaInicio: string | null
  vigenciaFin:    string | null
  esExtemporanea: boolean | null
  estado:         string
  periodo:        string | null
  destinatarios:  string[]
  firmadoPor: {
    reviso: string
    valido: string
    emitio: string
  } | null
  tipoDoc: "dictamen" | "opinion"
}

const INICIALES_MES_MAP: Record<string, string> = {
  "01": "EN", "02": "FE", "03": "MR", "04": "AB",
  "05": "MY", "06": "JN", "07": "JL", "08": "AG",
  "09": "SE", "10": "OC", "11": "NO", "12": "DI",
}

function formatearFolio(folio: string | null | undefined): string {
  if (!folio || folio === "—") return "—"
  const matchLegacy = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (matchLegacy) return `${matchLegacy[1]}/${matchLegacy[2].padStart(2, "0")}/${matchLegacy[3]}`
  const matchDictamen = folio.match(/^[A-Z]{2,3}-(\d+)-(\d{4})$/)
  if (matchDictamen) {
    return `${matchDictamen[1].padStart(3, "0")}-${matchDictamen[2]}`
  }
  return folio
}

function mesDesdeRaw(folio: string | null | undefined): string | null {
  if (!folio) return null
  const rawMatch = folio.match(/^\d+\/(\d{1,2})\/\d{4}$/)
  if (rawMatch) return rawMatch[1].padStart(2, "0")
  const prefijo = folio.split("-")[0]
  const entry = Object.entries(INICIALES_MES_MAP).find(([, v]) => v === prefijo)
  if (entry) return entry[0]
  return null
}

const MESES = [
  { value: "01", label: "Enero" },      { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },      { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },       { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },      { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" }, { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },  { value: "12", label: "Diciembre" },
]

function mapearDictamen(raw: any): DictamenEmitido {
  const esParaestatal = (raw.tipoAdministracion ?? "centralizada") === "paraestatal"

  return {
    id:             String(raw.id),
    folioDictamen:  raw.folioDictamen ??  null ,
    folioRecepcion: raw.folioRecepcion ?? null,
    fechaEmision:   raw.fechaEmision   ?? null,
    tipoFirma:      raw.tipoFirma      ?? null,
    archivoPdf:     raw.archivoPdf     ?? null,
    secretaria:     raw.secretaria     ?? "—",
    tipoSolicitud:  raw.tipoSolicitud  ?? raw.tipo ?? "—",
    regimen:        raw.regimen        ?? null,
    denominacion:   raw.denominacion   ?? raw.tipoSolicitud ?? raw.tipo ?? null,
    importeBruto:   raw.importeBruto   ?? null,
    vigenciaInicio: raw.vigenciaInicio ?? null,
    vigenciaFin:    raw.vigenciaFin    ?? null,
    esExtemporanea: raw.esExtemporanea ?? null,
    estado:         raw.estado         ?? "—",
    periodo:        raw.periodo        ?? null,
    destinatarios:  Array.isArray(raw.destinatarios) ? raw.destinatarios : [],
    firmadoPor:     raw.firmadoPor     ?? null,
    tipoDoc:        esParaestatal ? "opinion" : "dictamen",
  }
}

const DictamenViewModal = React.memo(({
  dictamen,
  onClose,
  isDownloading,
  onDownload,
}: {
  dictamen: DictamenEmitido
  onClose: () => void
  isDownloading: boolean
  onDownload: (firmas: Record<string, string>, formato: 'fisico' | 'en_linea') => void
}) => {
  const titulo =
    dictamen.tipoDoc === "dictamen"
      ? "DICTAMEN TÉCNICO FUNCIONAL"
      : "OPINIÓN TÉCNICA FUNCIONAL"

  const folioRecepcionFormateado = formatearFolio(dictamen.folioRecepcion)

  const [firmaElaboroNombre, setFirmaElaboroNombre] = useState("")
  const [firmaRevisoNombre, setFirmaRevisoNombre] = useState("")
  const [firmaVoBoJuridicoNombre, setFirmaVoBoJuridicoNombre] = useState("")
  const [firmaDictRevisoNombre, setFirmaDictRevisoNombre] = useState("")
  const [firmaDictVerificoNombre, setFirmaDictVerificoNombre] = useState("")
  const [firmaDictEmitioNombre, setFirmaDictEmitioNombre] = useState("")
  const [showFirmas, setShowFirmas] = useState(false)

  const formato: 'fisico' | 'en_linea' = dictamen.tipoFirma === 'electronica' ? 'en_linea' : 'fisico'

  const esNombramiento = dictamen.tipoSolicitud?.toLowerCase().includes("nombramiento")

  const [debouncedFirmas, setDebouncedFirmas] = useState({
    firmaElaboroNombre: "",
    firmaRevisoNombre: "",
    firmaVoBoJuridicoNombre: "",
    firmaDictRevisoNombre: "",
    firmaDictVerificoNombre: "",
    firmaDictEmitioNombre: ""
  })

  const commitFirmas = useCallback(() => {
    setDebouncedFirmas((prev) => {
      const next = {
        firmaElaboroNombre,
        firmaRevisoNombre,
        firmaVoBoJuridicoNombre,
        firmaDictRevisoNombre,
        firmaDictVerificoNombre,
        firmaDictEmitioNombre,
      }
      const sameValues =
        prev.firmaElaboroNombre === next.firmaElaboroNombre &&
        prev.firmaRevisoNombre === next.firmaRevisoNombre &&
        prev.firmaVoBoJuridicoNombre === next.firmaVoBoJuridicoNombre &&
        prev.firmaDictRevisoNombre === next.firmaDictRevisoNombre &&
        prev.firmaDictVerificoNombre === next.firmaDictVerificoNombre &&
        prev.firmaDictEmitioNombre === next.firmaDictEmitioNombre
      return sameValues ? prev : next
    })
  }, [firmaElaboroNombre, firmaRevisoNombre, firmaVoBoJuridicoNombre, firmaDictRevisoNombre, firmaDictVerificoNombre, firmaDictEmitioNombre])

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfRefreshing, setPdfRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const currentBlobRef = useRef<string | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPdfRefreshing(true)

    const params = new URLSearchParams({ id: dictamen.id })
    if (debouncedFirmas.firmaElaboroNombre) params.set("firmaElaboroNombre", debouncedFirmas.firmaElaboroNombre)
    if (debouncedFirmas.firmaRevisoNombre) params.set("firmaRevisoNombre", debouncedFirmas.firmaRevisoNombre)
    if (debouncedFirmas.firmaVoBoJuridicoNombre) params.set("firmaVoBoJuridicoNombre", debouncedFirmas.firmaVoBoJuridicoNombre)
    if (debouncedFirmas.firmaDictRevisoNombre) params.set("firmaDictRevisoNombre", debouncedFirmas.firmaDictRevisoNombre)
    if (debouncedFirmas.firmaDictVerificoNombre) params.set("firmaDictVerificoNombre", debouncedFirmas.firmaDictVerificoNombre)
    if (debouncedFirmas.firmaDictEmitioNombre) params.set("firmaDictEmitioNombre", debouncedFirmas.firmaDictEmitioNombre)
    params.set("formato", formato)

    fetch(`/api/pdf/justificacion?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Error al generar preview PDF")
        return res.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        const objectUrl = URL.createObjectURL(blob)
        const previous = currentBlobRef.current
        currentBlobRef.current = objectUrl
        setPdfBlobUrl(objectUrl)
        setPdfRefreshing(false)
        if (previous) URL.revokeObjectURL(previous)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        console.error("[PDF preview]", err)
        setPdfRefreshing(false)
      })

    return () => controller.abort()
  }, [dictamen.id, debouncedFirmas, formato])

  useEffect(() => {
    return () => {
      if (currentBlobRef.current) {
        URL.revokeObjectURL(currentBlobRef.current)
        currentBlobRef.current = null
      }
    }
  }, [])

  const handleDownload = useCallback(() => {
    onDownload({
      firmaElaboroNombre,
      firmaRevisoNombre,
      firmaVoBoJuridicoNombre,
      firmaDictRevisoNombre,
      firmaDictVerificoNombre,
      firmaDictEmitioNombre,
    }, formato)
  }, [onDownload, formato, firmaElaboroNombre, firmaRevisoNombre, firmaVoBoJuridicoNombre, firmaDictRevisoNombre, firmaDictVerificoNombre, firmaDictEmitioNombre])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Card className="w-[75vw] max-w-[75vw] h-[92vh] max-h-[92vh] flex flex-col shadow-xl border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center justify-center shrink-0">
              <FileTypeIcon name="dictamen.pdf" size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold text-card-foreground truncate">
                {titulo}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Número: {dictamen.folioDictamen ?? "—"} | Folio Recepción: {folioRecepcionFormateado}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
            >
              Cerrar
            </Button>
            <Button variant="default" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5 min-w-[130px]">
              {isDownloading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDownloading ? "Generando..." : "Descargar"}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowFirmas(!showFirmas)}
              className="gap-1.5 font-medium hover:opacity-90"
              style={{ backgroundColor: "#773357", color: "#ffffff", border: "1px solid #773357" }}
            >
              {showFirmas ? "Ocultar Firmas" : "Editar Firmas"}
            </Button>
          </div>
        </CardHeader>

        <div className="flex flex-1 overflow-hidden">
          {showFirmas && (
            <div className="w-72 shrink-0 border-r border-border p-4 overflow-y-auto space-y-4 bg-muted/30">
              <h4 className="text-sm font-semibold text-card-foreground mb-3">Nombres de Firmantes</h4>

              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Página Principal</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Elaboró</label>
                  <Input value={firmaElaboroNombre} onChange={(e) => setFirmaElaboroNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Revisó</label>
                  <Input value={firmaRevisoNombre} onChange={(e) => setFirmaRevisoNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                </div>
                {esNombramiento && (
                  <div>
                    <label className="text-xs text-muted-foreground">Vo. Bo. Jurídico</label>
                    <Input value={firmaVoBoJuridicoNombre} onChange={(e) => setFirmaVoBoJuridicoNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                  </div>
                )}
              </div>

              <hr className="border-border" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Página Dictaminación</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Revisó</label>
                  <Input value={firmaDictRevisoNombre} onChange={(e) => setFirmaDictRevisoNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Verificó</label>
                  <Input value={firmaDictVerificoNombre} onChange={(e) => setFirmaDictVerificoNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Emitió</label>
                  <Input value={firmaDictEmitioNombre} onChange={(e) => setFirmaDictEmitioNombre(e.target.value)} onBlur={commitFirmas} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} placeholder="Nombre y cargo" className="h-8 text-xs" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                La vista previa se actualiza al salir del campo o presionar Enter.
              </p>
            </div>
          )}

          <div className="flex-1 min-h-0 p-3 bg-[#1F2937]">
            <div className="w-full h-full rounded-md overflow-hidden">
              <PdfPreview
                fileUrl={pdfBlobUrl}
                refreshing={pdfRefreshing}
                label={pdfBlobUrl ? "Preparando vista…" : "Generando vista previa…"}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})

export function DictamenesPage() {
  const { user } = useAuth()
  const hasDataRef                   = useRef(false)
  const [dictamenes, setDictamenes] = useState<DictamenEmitido[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [viewing,    setViewing]    = useState<DictamenEmitido | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [searchTerm,       setSearchTerm]       = useState("")
  const [filterAnio,       setFilterAnio]       = useState("todos")
  const [filterMes,        setFilterMes]        = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterTipo,       setFilterTipo]       = useState("todos")
  const [currentPage,      setCurrentPage]      = useState(1)

  const descargarPdfDictamen = async (solicitudId: string, folio: string | null, firmas: Record<string, string> = {}, formato: 'fisico' | 'en_linea' = 'fisico') => {
    setDownloadingId(solicitudId)
    try {
      const res = await fetch("/api/pdf/justificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, ...firmas, formato })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Ocurrió un error al generar el PDF")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const folioName = folio ? folio.replace(/\//g, "-") : solicitudId
      const suffix = formato === 'en_linea' ? '_EnLinea' : ''
      a.download = `Dictamen_${folioName}${suffix}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Error al descargar el PDF")
    } finally {
      setDownloadingId(null)
    }
  }

  const cargar = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const userId = (user as any)?.id ?? ""
      const res  = await fetch(`/api/emision?vista=emitidos&userId=${userId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar dictámenes"); return }
      setDictamenes((json.data ?? []).map(mapearDictamen))
      hasDataRef.current = true
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { cargar() }, [cargar])
  useRealtime(["dictamenes"], cargar)

  const secretariasUnicas = useMemo(
    () => [...new Set(dictamenes.map((d) => d.secretaria))].filter(Boolean).sort(),
    [dictamenes]
  )

  const filtered = useMemo(
    () => {
      let result = dictamenes;

      if (searchTerm) {
        const t = normalizeText(searchTerm);
        result = result.filter((d) =>
          normalizeText(formatearFolio(d.folioDictamen)).includes(t) ||
          normalizeText(d.folioDictamen ?? "").includes(t) ||
          normalizeText(formatearFolio(d.folioRecepcion)).includes(t) ||
          normalizeText(d.folioRecepcion ?? "").includes(t) ||
          normalizeText(d.secretaria).includes(t) ||
          normalizeText(d.denominacion ?? "").includes(t)
        );
      }

      if (filterAnio !== "todos") {
        result = result.filter((d) => d.fechaEmision?.startsWith(filterAnio));
      }

      if (filterMes !== "todos") {
        result = result.filter((d) => {
          if (d.fechaEmision) return d.fechaEmision.slice(5, 7) === filterMes;
          const mesFolio = mesDesdeRaw(d.folioRecepcion);
          return mesFolio === filterMes;
        });
      }

      if (filterSecretaria !== "todas") {
        result = result.filter((d) => d.secretaria === filterSecretaria);
      }

      if (filterTipo !== "todos") {
        result = result.filter((d) => {
          if (filterTipo === "dictamen") return d.tipoDoc === "dictamen";
          if (filterTipo === "opinion") return d.tipoDoc === "opinion";
          return true;
        });
      }

      return result;
    },
    [dictamenes, searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo]
  )

  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo])

  const totalPages    = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated     = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const totalDictamenes  = dictamenes.filter((d) => d.tipoDoc === "dictamen").length
  const totalOpiniones   = dictamenes.filter((d) => d.tipoDoc === "opinion").length
  const totalElectronica = dictamenes.filter((d) => d.tipoFirma === "electronica").length

  return (
    <PageLayout
      title="Dictámenes y opiniones emitidas"
      description="Consulta el registro de dictámenes y opiniones técnicas emitidos."
    >
      {viewing && (
        <DictamenViewModal 
          dictamen={viewing} 
          onClose={() => setViewing(null)} 
          isDownloading={downloadingId === viewing.id}
          onDownload={(firmas, formato) => descargarPdfDictamen(viewing.id, viewing.folioDictamen, firmas, formato)}
        />
      )}


      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargar} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}


      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Buscar por número, folio, denominación, secretaría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          containerClassName="flex-1 max-w-sm"
        />

        <div className="flex flex-col gap-1">

          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-40 bg-card"><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="dictamen">Dictamen</SelectItem>
              <SelectItem value="opinion">Opinión</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {loading
              ? "Cargando..."
              : `${filtered.length} registro${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              <span className="text-sm text-muted-foreground">Cargando desde la base de datos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[8px] border border-[#E5E7EB] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-3 text-left font-semibold">Folio Dictamen</th>
                    <th className="px-4 py-3 text-left font-semibold">Folio Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Secretaría</th>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold">Denominación</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha Dict.</th>
                    <th className="px-4 py-3 text-left font-semibold">Modalidad</th>
                    <th className="px-4 py-3 text-left font-semibold">Destinatarios</th>
                    <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        No se encontraron dictámenes emitidos
                      </td>
                    </tr>
                  ) : paginated.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">

                      <td className="px-4 py-3 font-medium text-card-foreground font-mono text-xs">
                        {d.folioDictamen ?? "—"}
                      </td>

                      <td className="px-4 py-3 font-medium text-card-foreground font-mono text-xs">
                        {formatearFolio(d.folioRecepcion)}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs break-words max-w-[200px]">{d.secretaria}</td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          label={d.tipoDoc === "dictamen" ? "Dictamen" : "Opinión"}
                          color="#15803d"
                        />
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] break-words">
                        <span className="line-clamp-2">{d.denominacion ?? "—"}</span>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.fechaEmision
                          ? (() => { const [y,m,dd] = d.fechaEmision!.split("-").map(Number); return new Date(y,m-1,dd).toLocaleDateString("es-MX") })()
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          label={d.tipoFirma === "electronica" ? "Electrónica" : "Autógrafa"}
                          color={d.tipoFirma === "electronica" ? "#0891B2" : "#15803d"}
                        />
                      </td>

                      <td className="px-4 py-3">
                        {d.destinatarios.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-40">
                            {d.destinatarios.slice(0, 2).map((dest, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1.5">
                                {dest.length > 20 ? dest.slice(0, 20) + "…" : dest}
                              </Badge>
                            ))}
                            {d.destinatarios.length > 2 && (
                              <Badge variant="outline" className="text-[9px] px-1.5">
                                +{d.destinatarios.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {downloadingId === d.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewing(d)} className="gap-2 cursor-pointer">
                              <Eye className="h-4 w-4" />
                              Ver dictamen
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => descargarPdfDictamen(
                                d.id,
                                d.folioDictamen,
                                {},
                                d.tipoFirma === 'electronica' ? 'en_linea' : 'fisico',
                              )}
                              disabled={downloadingId === d.id}
                              className="gap-2 cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                              Descargar PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </PageLayout>
  )
}