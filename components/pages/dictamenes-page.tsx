"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Download, Eye, FileCheck, Stamp, Printer } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { useSolicitudes, type Solicitud } from "@/lib/solicitudes-store"

const SECRETARIAS = [
  "Sec. de Finanzas",
  "Sec. de Educacion",
  "Sec. de Salud",
  "Sec. de Gobierno",
  "Sec. de Obras",
  "Sec. de Desarrollo",
]

const MESES = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

// ── Dictamen Preview Modal (inline) ──
function DictamenViewModal({ solicitud, onClose }: { solicitud: Solicitud; onClose: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null)
  if (!solicitud.emisionData) return null

  const ed = solicitud.emisionData
  const titulo = solicitud.tipoAdministracion === "centralizada"
    ? "DICTAMEN TECNICO FUNCIONAL"
    : "OPINION TECNICA FUNCIONAL"

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${titulo}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;font-size:11pt;line-height:1.5}
      h1{text-align:center;font-size:14pt;margin-bottom:4px;letter-spacing:1px}
      h2{font-size:12pt;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px}
      .header{text-align:center;border-bottom:2px solid #283c2a;padding-bottom:16px;margin-bottom:20px}
      .header p{margin:2px 0;font-size:9pt;color:#555}
      .sello{text-align:center;margin-top:30px;padding:12px;border:2px solid #283c2a;color:#283c2a;font-weight:bold;letter-spacing:3px;font-size:14pt}
      .firmas{display:flex;justify-content:space-between;margin-top:60px}
      .firma-block{text-align:center;width:200px}
      .firma-line{border-top:1px solid #333;margin-top:60px;padding-top:4px}
      .firma-role{font-size:9pt;color:#666}</style>
      </head><body>
      <div class="header"><p>GOBIERNO DEL ESTADO</p><p>SECRETARIA DE ADMINISTRACION</p><p>DIRECCION DE ORGANIZACION</p><h1>${titulo}</h1></div>
      <p><strong>Numero:</strong> ${ed.numeroDictamen}</p>
      <p><strong>Folio Recepcion:</strong> ${solicitud.folioRecepcion}</p>
      <p><strong>Fecha:</strong> ${ed.fechaDictaminacion}</p>
      <p><strong>Modalidad:</strong> ${ed.modalidadFirma === "electronica" ? "Firma Electronica" : "Firma Autografa"}</p>
      <h2>Destinatarios</h2><ul>${ed.destinatarios.map(d => `<li>${d}</li>`).join("")}</ul>
      <h2>Datos del Solicitante</h2>
      <p><strong>Secretaria:</strong> ${solicitud.secretaria} | <strong>Denominacion:</strong> ${solicitud.denominacion}</p>
      <p><strong>Vigencia:</strong> ${solicitud.vigenciaInicio} - ${solicitud.vigenciaFin} | <strong>Importe:</strong> ${solicitud.importeBruto}</p>
      <div class="firmas">
        <div class="firma-block"><div class="firma-line"><p>${ed.firmadoPor.reviso}</p><p class="firma-role">Reviso</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${ed.firmadoPor.valido}</p><p class="firma-role">Valido</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${ed.firmadoPor.emitio}</p><p class="firma-role">Emitio</p></div></div>
      </div>
      <div class="sello">DICTAMINADO</div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
          <div>
            <CardTitle className="text-base font-semibold text-card-foreground">{titulo}</CardTitle>
            <p className="text-xs text-muted-foreground">Numero: {ed.numeroDictamen} | Folio: {solicitud.folioRecepcion}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div ref={previewRef} className="bg-card rounded-lg p-6 border border-border flex flex-col gap-4">
            <div className="text-center border-b-2 border-primary pb-4">
              <p className="text-xs text-muted-foreground">GOBIERNO DEL ESTADO</p>
              <p className="text-xs text-muted-foreground">SECRETARIA DE ADMINISTRACION</p>
              <p className="text-xs text-muted-foreground">DIRECCION DE ORGANIZACION</p>
              <p className="text-base font-bold text-card-foreground mt-2 tracking-wide">{titulo}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-muted-foreground block">Numero</span><span className="text-sm font-semibold text-card-foreground">{ed.numeroDictamen}</span></div>
              <div><span className="text-xs text-muted-foreground block">Folio Recepcion</span><span className="text-sm font-semibold text-card-foreground">{solicitud.folioRecepcion}</span></div>
              <div><span className="text-xs text-muted-foreground block">Fecha Dictaminacion</span><span className="text-sm font-semibold text-card-foreground">{ed.fechaDictaminacion}</span></div>
              <div><span className="text-xs text-muted-foreground block">Modalidad</span><span className="text-sm font-semibold text-card-foreground">{ed.modalidadFirma === "electronica" ? "Firma Electronica" : "Firma Autografa"}</span></div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Destinatarios</span>
              <div className="flex flex-wrap gap-1">{ed.destinatarios.map((d, i) => <Badge key={i} variant="outline" className="text-xs">{d}</Badge>)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-muted-foreground block">Secretaria</span><span className="text-sm text-card-foreground">{solicitud.secretaria}</span></div>
              <div><span className="text-xs text-muted-foreground block">Denominacion</span><span className="text-sm text-card-foreground">{solicitud.denominacion}</span></div>
              <div><span className="text-xs text-muted-foreground block">Vigencia</span><span className="text-sm text-card-foreground">{solicitud.vigenciaInicio} - {solicitud.vigenciaFin}</span></div>
              <div><span className="text-xs text-muted-foreground block">Importe</span><span className="text-sm text-card-foreground">{solicitud.importeBruto}</span></div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Reviso</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.reviso}</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Valido</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.valido}</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Emitio</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.emitio}</span>
              </div>
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

export function DictamenesPage() {
  const { getEmitidos } = useSolicitudes()
  const emitidos = getEmitidos()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterAnio, setFilterAnio] = useState("todos")
  const [filterMes, setFilterMes] = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterTipo, setFilterTipo] = useState("todos")
  const [viewingSolicitud, setViewingSolicitud] = useState<Solicitud | null>(null)

  const filtered = useMemo(() => {
    return emitidos
      .filter((s) => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase()
        return (
          s.emisionData?.numeroDictamen.toLowerCase().includes(term) ||
          s.folioRecepcion?.toLowerCase().includes(term) ||
          s.secretaria.toLowerCase().includes(term) ||
          s.denominacion.toLowerCase().includes(term)
        )
      })
      .filter((s) => {
        if (filterAnio === "todos") return true
        return s.emisionData?.fechaDictaminacion.startsWith(filterAnio)
      })
      .filter((s) => {
        if (filterMes === "todos") return true
        return s.emisionData?.fechaDictaminacion.slice(5, 7) === filterMes
      })
      .filter((s) => filterSecretaria === "todas" || s.secretaria === filterSecretaria)
      .filter((s) => {
        if (filterTipo === "todos") return true
        if (filterTipo === "dictamen") return s.tipoAdministracion === "centralizada"
        if (filterTipo === "opinion") return s.tipoAdministracion === "paraestatal"
        return true
      })
  }, [emitidos, searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo])

  return (
    <PageLayout
      title="Dictamenes Emitidos"
      description="Registro de dictamenes y opiniones tecnicas emitidos"
    >
      {viewingSolicitud && (
        <DictamenViewModal solicitud={viewingSolicitud} onClose={() => setViewingSolicitud(null)} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{emitidos.length}</span>
              <p className="text-xs text-muted-foreground">Total emitidos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <Stamp className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{emitidos.filter(s => s.tipoAdministracion === "centralizada").length}</span>
              <p className="text-xs text-muted-foreground">Dictamenes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <Stamp className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{emitidos.filter(s => s.tipoAdministracion === "paraestatal").length}</span>
              <p className="text-xs text-muted-foreground">Opiniones</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <FileCheck className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{emitidos.filter(s => s.emisionData?.modalidadFirma === "electronica").length}</span>
              <p className="text-xs text-muted-foreground">Firma electronica</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, folio, secretaria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="w-28 bg-card">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMes} onValueChange={setFilterMes}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSecretaria} onValueChange={setFilterSecretaria}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Secretaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {SECRETARIAS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="dictamen">Dictamen</SelectItem>
            <SelectItem value="opinion">Opinion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {filtered.length} dictamenes/opiniones encontrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="px-3 py-3 text-left font-semibold">Num. Dictamen</th>
                  <th className="px-3 py-3 text-left font-semibold">Folio Recepcion</th>
                  <th className="px-3 py-3 text-left font-semibold">Secretaria</th>
                  <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold">Tipo Solicitud</th>
                  <th className="px-3 py-3 text-left font-semibold">Fecha Dict.</th>
                  <th className="px-3 py-3 text-left font-semibold">Modalidad</th>
                  <th className="px-3 py-3 text-left font-semibold">Destinatarios</th>
                  <th className="px-3 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      No se encontraron dictamenes emitidos
                    </td>
                  </tr>
                ) : (
                  filtered.map((sol) => {
                    const ed = sol.emisionData!
                    const esDictamen = sol.tipoAdministracion === "centralizada"
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-3 py-3 font-medium text-card-foreground font-mono text-xs">{ed.numeroDictamen}</td>
                        <td className="px-3 py-3 font-medium text-card-foreground">{sol.folioRecepcion}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{sol.secretaria}</td>
                        <td className="px-3 py-3">
                          <Badge className={`text-[10px] border-0 ${esDictamen ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"}`}>
                            {esDictamen ? "Dictamen" : "Opinion"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{sol.tipo}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{ed.fechaDictaminacion}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {ed.modalidadFirma === "electronica" ? "Electronica" : "Autografa"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1 max-w-40">
                            {ed.destinatarios.slice(0, 2).map((d, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1.5">{d.length > 20 ? d.slice(0, 20) + "..." : d}</Badge>
                            ))}
                            {ed.destinatarios.length > 2 && (
                              <Badge variant="outline" className="text-[9px] px-1.5">+{ed.destinatarios.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewingSolicitud(sol)} className="text-secondary hover:text-primary gap-1">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-secondary hover:text-primary gap-1" onClick={() => {
                              // trigger download via print
                              setViewingSolicitud(sol)
                            }}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
