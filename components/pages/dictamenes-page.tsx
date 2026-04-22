"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search, Download, Eye, FileCheck, Stamp, Printer,
  Loader2, AlertTriangle, RefreshCw,
} from "lucide-react"
import { PageLayout } from "@/components/page-layout"
// tipos
interface DictamenEmitido {
  id:             string
  folioDictamen:  string | null
  folioRecepcion: string | null
  fechaEmision:   string | null
  tipoFirma:      string | null
  archivoPdf:     string | null
  secretaria:     string
  tipoSolicitud:  string
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

// ── Mapper API
function mapearDictamen(raw: any): DictamenEmitido {
  const esParaestatal = (raw.tipoSolicitudRaw ?? raw.tipoSolicitud ?? raw.tipo ?? "")
    .toLowerCase()
    .includes("paraestatal")

  return {
    id:             String(raw.id),
    folioDictamen:  raw.folioDictamen ??  null ,
    folioRecepcion: raw.folioRecepcion ?? null,
    fechaEmision:   raw.fechaEmision   ?? null,
    tipoFirma:      raw.tipoFirma      ?? null,
    archivoPdf:     raw.archivoPdf     ?? null,
    secretaria:     raw.secretaria     ?? "—",
    tipoSolicitud:  raw.tipoSolicitud  ?? raw.tipo ?? "—",
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

function DictamenViewModal({
  dictamen,
  onClose,
  isDownloading,
  onDownload,
}: {
  dictamen: DictamenEmitido
  onClose: () => void
  isDownloading: boolean
  onDownload: () => void
}) {
  const titulo =
    dictamen.tipoDoc === "dictamen"
      ? "DICTAMEN TÉCNICO FUNCIONAL"
      : "OPINIÓN TÉCNICA FUNCIONAL"

  const folioRecepcionFormateado = formatearFolio(dictamen.folioRecepcion)

  const handlePrint = () => {
    onDownload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
          <div>
            <CardTitle className="text-base font-semibold text-card-foreground">
              {titulo}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Número: {dictamen.folioDictamen ?? "—"} | Folio Recepción: {folioRecepcionFormateado}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isDownloading} className="gap-1.5 min-w-[140px]">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Generando..." : "Descargar PDF"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="w-full h-[70vh] bg-muted rounded-md border border-border overflow-hidden">
            <iframe 
              src={`/api/pdf/justificacion?id=${dictamen.id}#toolbar=0&view=FitH`} 
              className="w-full h-full border-0" 
              title={`Vista previa Dictamen ${dictamen.folioDictamen ?? dictamen.id}`}
            />
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}
// pagina Principal
export function DictamenesPage() {
  const { user } = useAuth()
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

  const descargarPdfDictamen = async (solicitudId: string, folio: string | null) => {
    setDownloadingId(solicitudId)
    try {
      const res = await fetch("/api/pdf/justificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId })
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
      a.download = `Dictamen_${folioName}.pdf`
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
    setLoading(true); setError(null)
    try {
      const userId = (user as any)?.id ?? ""
      const res  = await fetch(`/api/emision?vista=emitidos&userId=${userId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar dictámenes"); return }
      setDictamenes((json.data ?? []).map(mapearDictamen))
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { cargar() }, [cargar])

  const secretariasUnicas = useMemo(
    () => [...new Set(dictamenes.map((d) => d.secretaria))].filter(Boolean).sort(),
    [dictamenes]
  )

  const filtered = useMemo(
    () =>
      dictamenes
        .filter((d) => {
          if (!searchTerm) return true
          const t = searchTerm.toLowerCase()
          return (
            formatearFolio(d.folioDictamen).toLowerCase().includes(t)  ||
            d.folioDictamen.toLowerCase().includes(t)                   ||
            formatearFolio(d.folioRecepcion).toLowerCase().includes(t)  ||
            (d.folioRecepcion?.toLowerCase().includes(t) ?? false)      ||
            d.secretaria.toLowerCase().includes(t)                      ||
            (d.denominacion?.toLowerCase().includes(t) ?? false)
          )
        })
        .filter((d) => {
          if (filterAnio === "todos") return true
          return d.fechaEmision?.startsWith(filterAnio) ?? false
        })
        .filter((d) => {
          if (filterMes === "todos") return true
          if (d.fechaEmision) return d.fechaEmision.slice(5, 7) === filterMes
          const mesFolio = mesDesdeRaw(d.folioRecepcion)
          if (mesFolio) return mesFolio === filterMes
          return false
        })
        .filter((d) => filterSecretaria === "todas" || d.secretaria === filterSecretaria)
        .filter((d) => {
          if (filterTipo === "todos")    return true
          if (filterTipo === "dictamen") return d.tipoDoc === "dictamen"
          if (filterTipo === "opinion")  return d.tipoDoc === "opinion"
          return true
        }),
    [dictamenes, searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo]
  )

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
          onDownload={() => descargarPdfDictamen(viewing.id, viewing.folioDictamen)}
        />
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargar} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total emitidos",    value: dictamenes.length,  icon: <FileCheck className="h-5 w-5 text-primary" />,       bg: "bg-primary/10" },
          { label: "Dictámenes",        value: totalDictamenes,    icon: <Stamp className="h-5 w-5 text-secondary" />,         bg: "bg-secondary/10" },
          { label: "Opiniones",         value: totalOpiniones,     icon: <Stamp className="h-5 w-5 text-accent-foreground" />, bg: "bg-accent/10" },
          { label: "Firma electrónica", value: totalElectronica,   icon: <FileCheck className="h-5 w-5 text-secondary" />,     bg: "bg-secondary/10" },
        ].map((c, i) => (
          <Card key={i} className="shadow-sm border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                {c.icon}
              </div>
              <div>
                <span className="text-2xl font-bold text-card-foreground">{c.value}</span>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, folio, denominación, secretaría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="w-28 bg-card"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMes} onValueChange={setFilterMes}>
          <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSecretaria} onValueChange={setFilterSecretaria}>
          <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Secretaría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {secretariasUnicas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="dictamen">Dictamen</SelectItem>
            <SelectItem value="opinion">Opinión</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
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
            <div className="overflow-x-auto">
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
                  ) : filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">

                      <td className="px-4 py-3 font-medium text-card-foreground font-mono text-xs">
                        {d.folioDictamen ?? "—"}
                      </td>

                      { }
                      <td className="px-4 py-3 font-medium text-card-foreground font-mono text-xs">
                        {formatearFolio(d.folioRecepcion)}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs">{d.secretaria}</td>

                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] border-0 ${
                          d.tipoDoc === "dictamen"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent-foreground"
                        }`}>
                          {d.tipoDoc === "dictamen" ? "Dictamen" : "Opinión"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">
                        <span className="line-clamp-2">{d.denominacion ?? "—"}</span>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {d.fechaEmision
                          ? new Date(d.fechaEmision).toLocaleDateString("es-MX")
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {d.tipoFirma === "electronica" ? "Electrónica" : "Autógrafa"}
                        </Badge>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setViewing(d)}
                            className="text-secondary hover:text-primary"
                            title="Ver dictamen"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => descargarPdfDictamen(d.id, d.folioDictamen)}
                            disabled={downloadingId === d.id}
                            className="text-secondary hover:text-primary min-w-[32px]"
                            title="Descargar PDF"
                          >
                            {downloadingId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}