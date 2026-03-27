"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
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


  const matchLegacy = folio.match(/^(\d+)\/(\d{1,2})\/\d{4}$/)
  if (matchLegacy) {
    return matchLegacy[1].padStart(3, "0")
  }

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

// Modal de vista Dictamen
function DictamenViewModal({
  dictamen,
  onClose,
}: {
  dictamen: DictamenEmitido
  onClose: () => void
}) {
  const titulo =
    dictamen.tipoDoc === "dictamen"
      ? "DICTAMEN TÉCNICO FUNCIONAL"
      : "OPINIÓN TÉCNICA FUNCIONAL"

  const folioRecepcionFormateado = formatearFolio(dictamen.folioRecepcion)

  const handlePrint = () => {
    const pw = window.open("", "_blank")
    if (!pw) return
    pw.document.write(`
      <!DOCTYPE html><html><head><title>${titulo}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 11pt; line-height: 1.5 }
        h2   { font-size: 12pt; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px }
        .header { text-align: center; border-bottom: 2px solid #283c2a; padding-bottom: 16px; margin-bottom: 20px }
        .header p { margin: 2px 0; font-size: 9pt; color: #555 }
        .header h1 { font-size: 14pt; margin-bottom: 4px; letter-spacing: 1px }
        .sello { text-align: center; margin-top: 30px; padding: 12px; border: 2px solid #283c2a;
                 color: #283c2a; font-weight: bold; letter-spacing: 3px; font-size: 14pt }
        .firmas { display: flex; justify-content: space-between; margin-top: 60px }
        .firma-block { text-align: center; width: 200px }
        .firma-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 4px }
        .firma-role { font-size: 9pt; color: #666 }
      </style></head><body>
      <div class="header">
        <p>GOBIERNO DEL ESTADO</p>
        <p>SECRETARÍA DE ADMINISTRACIÓN</p>
        <p>DIRECCIÓN DE ORGANIZACIÓN</p>
        <h1>${titulo}</h1>
      </div>
      <p><strong>Número:</strong> ${dictamen.folioDictamen ?? "—"}</p>
      <p><strong>Folio Recepción:</strong> ${folioRecepcionFormateado}</p>
      <p><strong>Fecha:</strong> ${dictamen.fechaEmision ? new Date(dictamen.fechaEmision).toLocaleDateString("es-MX") : "—"}</p>
      <p><strong>Modalidad:</strong> ${dictamen.tipoFirma === "electronica" ? "Firma Electrónica" : "Firma Autógrafa"}</p>
      <h2>Destinatarios</h2>
      <ul>${dictamen.destinatarios.length > 0
        ? dictamen.destinatarios.map((d) => `<li>${d}</li>`).join("")
        : "<li>—</li>"
      }</ul>
      <h2>Datos del Solicitante</h2>
      <p><strong>Secretaría:</strong> ${dictamen.secretaria} &nbsp;|&nbsp; <strong>Denominación:</strong> ${dictamen.denominacion ?? "—"}</p>
      <p><strong>Vigencia:</strong> ${dictamen.vigenciaInicio ?? "—"} — ${dictamen.vigenciaFin ?? "—"} &nbsp;|&nbsp; <strong>Importe:</strong> ${dictamen.importeBruto ?? "—"}</p>
      <div class="firmas">
        <div class="firma-block"><div class="firma-line"><p>${dictamen.firmadoPor?.reviso ?? "—"}</p><p class="firma-role">Revisó</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${dictamen.firmadoPor?.valido ?? "—"}</p><p class="firma-role">Validó</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${dictamen.firmadoPor?.emitio ?? "—"}</p><p class="firma-role">Emitió</p></div></div>
      </div>
      <div class="sello">DICTAMINADO</div>
      </body></html>
    `)
    pw.document.close()
    pw.focus()
    setTimeout(() => pw.print(), 500)
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
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />Descargar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="bg-card rounded-lg p-6 border border-border flex flex-col gap-4">
            <div className="text-center border-b-2 border-primary pb-4">
              <p className="text-xs text-muted-foreground">GOBIERNO DEL ESTADO</p>
              <p className="text-xs text-muted-foreground">SECRETARÍA DE ADMINISTRACIÓN</p>
              <p className="text-xs text-muted-foreground">DIRECCIÓN DE ORGANIZACIÓN</p>
              <p className="text-base font-bold text-card-foreground mt-2 tracking-wide">{titulo}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block">Número</span>
                <span className="text-sm font-semibold text-card-foreground font-mono">
                  {dictamen.folioDictamen ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Folio Recepción</span>
                <span className="text-sm font-semibold text-card-foreground font-mono">
                  {folioRecepcionFormateado}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Fecha Dict.</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {dictamen.fechaEmision
                    ? new Date(dictamen.fechaEmision).toLocaleDateString("es-MX")
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Modalidad</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {dictamen.tipoFirma === "electronica" ? "Firma Electrónica" : "Firma Autógrafa"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Destinatarios</span>
              {dictamen.destinatarios.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {dictamen.destinatarios.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block">Secretaría</span>
                <span className="text-sm text-card-foreground">{dictamen.secretaria}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Denominación</span>
                <span className="text-sm text-card-foreground">{dictamen.denominacion ?? "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Vigencia</span>
                <span className="text-sm text-card-foreground">
                  {dictamen.vigenciaInicio
                    ? new Date(dictamen.vigenciaInicio).toLocaleDateString("es-MX")
                    : "—"}{" "}—{" "}
                  {dictamen.vigenciaFin
                    ? new Date(dictamen.vigenciaFin).toLocaleDateString("es-MX")
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Importe</span>
                <span className="text-sm text-card-foreground">{dictamen.importeBruto ?? "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {(["reviso", "valido", "emitio"] as const).map((rol) => (
                <div key={rol} className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                  <span className="text-[10px] text-muted-foreground">
                    {rol === "reviso" ? "Revisó" : rol === "valido" ? "Validó" : "Emitió"}
                  </span>
                  <span className="text-xs font-medium text-card-foreground">
                    {dictamen.firmadoPor?.[rol] ?? "—"}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center mt-4 py-3 border-2 border-primary text-primary font-bold tracking-widest text-lg">
              DICTAMINADO
            </div>
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}
// pagina Principal
export function DictamenesPage() {
  const [dictamenes, setDictamenes] = useState<DictamenEmitido[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [viewing,    setViewing]    = useState<DictamenEmitido | null>(null)

  const [searchTerm,       setSearchTerm]       = useState("")
  const [filterAnio,       setFilterAnio]       = useState("todos")
  const [filterMes,        setFilterMes]        = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterTipo,       setFilterTipo]       = useState("todos")

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch("/api/emision?vista=emitidos")
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar dictámenes"); return }
      setDictamenes((json.data ?? []).map(mapearDictamen))
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [])

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
      title="Dictámenes Emitidos"
      description="Registro de dictámenes y opiniones técnicas emitidos"
    >
      {viewing && <DictamenViewModal dictamen={viewing} onClose={() => setViewing(null)} />}

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
                  <tr className="border-b border-border">
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Núm. Dictamen</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Folio Recepción</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Secretaría</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Denominación</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Fecha Dict.</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Modalidad</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Destinatarios</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Acciones</th>
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

                      <td className="px-3 py-3 font-medium text-card-foreground font-mono text-xs">
                        {d.folioDictamen ?? "—"}
                      </td>

                      { }
                      <td className="px-3 py-3 font-medium text-card-foreground font-mono text-xs">
                        {formatearFolio(d.folioRecepcion)}
                      </td>

                      <td className="px-3 py-3 text-muted-foreground text-xs">{d.secretaria}</td>

                      <td className="px-3 py-3">
                        <Badge className={`text-[10px] border-0 ${
                          d.tipoDoc === "dictamen"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent-foreground"
                        }`}>
                          {d.tipoDoc === "dictamen" ? "Dictamen" : "Opinión"}
                        </Badge>
                      </td>

                      <td className="px-3 py-3 text-muted-foreground text-xs max-w-[200px]">
                        <span className="line-clamp-2">{d.denominacion ?? "—"}</span>
                      </td>

                      <td className="px-3 py-3 text-muted-foreground text-xs">
                        {d.fechaEmision
                          ? new Date(d.fechaEmision).toLocaleDateString("es-MX")
                          : "—"}
                      </td>

                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {d.tipoFirma === "electronica" ? "Electrónica" : "Autógrafa"}
                        </Badge>
                      </td>

                      <td className="px-3 py-3">
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

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setViewing(d)}
                            className="text-secondary hover:text-primary"
                            title="Ver dictamen"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {d.archivoPdf ? (
                            <a href={d.archivoPdf} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="sm" className="text-secondary hover:text-primary" title="Descargar PDF">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          ) : (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setViewing(d)}
                              className="text-secondary hover:text-primary"
                              title="Imprimir dictamen"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
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