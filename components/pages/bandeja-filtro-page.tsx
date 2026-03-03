"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  FileSearch,
  Filter,
  Clock,
  RotateCcw,
  CircleDot,
  Eye,
  AlertTriangle,
  ListFilter,
  RefreshCcw,
} from "lucide-react"
import {
  useSolicitudes,
  getSlaColor,
  getSlaBackground,
  getSlaLabel,
  getEstadoVariant,
  type Estado,
  type Solicitud,
} from "@/lib/solicitudes-store"

interface BandejaFiltroPageProps {
  filtro: 1 | 2 | 3
  onOpenReview: (solicitudId: string, filtro: 1 | 2 | 3) => void
}

const FILTRO_LABELS: Record<number, string> = {
  1: "Filtro 1",
  2: "Filtro 2",
  3: "Filtro 3 (Direccion General)",
}

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

type TabKey = "nuevas" | "correcciones" | "revision" | "observadas" | "todas"

// ── Tab classification ──
function classifySolicitud(s: Solicitud, filtro: 1 | 2 | 3): TabKey {
  const estadoEnRevision = `En revision DO Filtro ${filtro}` as Estado
  const estadoObservado = `Observado DO Filtro ${filtro}` as Estado

  if (s.estado === estadoObservado) {
    return "observadas"
  }

  if (s.estado === estadoEnRevision) {
    // Correction: reingresoCount > 0 and hasn't been opened yet in this filtro
    if (s.reingresoCount > 0 && !s.openedInFiltro[filtro]) {
      return "correcciones"
    }
    // Nueva: first time at this filtro, never observed here, not opened
    if (s.isNuevaEnFiltro[filtro] && !s.openedInFiltro[filtro]) {
      return "nuevas"
    }
    // If opened (has partial checklist or was opened) -> En revision
    if (s.openedInFiltro[filtro]) {
      return "revision"
    }
    // Default for "En revision" that wasn't categorized: nueva
    return "nuevas"
  }

  return "todas"
}

// ── SLA indicator ──
function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  const color = getSlaColor(diasRestantes)
  const bg = getSlaBackground(diasRestantes)
  const label = getSlaLabel(diasRestantes)

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${color}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: Estado }) {
  const variant = getEstadoVariant(estado)
  return (
    <Badge className={`${variant.bg} ${variant.text} hover:${variant.bg} border-0 text-xs`}>
      {estado}
    </Badge>
  )
}

// ── Tab badge colors ──
const TAB_CONFIG: Record<TabKey, { label: string; icon: React.ReactNode; color: string; activeBg: string; activeText: string }> = {
  nuevas: {
    label: "Nuevas",
    icon: <CircleDot className="h-3.5 w-3.5" />,
    color: "text-secondary",
    activeBg: "bg-secondary/10",
    activeText: "text-secondary",
  },
  correcciones: {
    label: "Correcciones",
    icon: <RotateCcw className="h-3.5 w-3.5" />,
    color: "text-accent-foreground",
    activeBg: "bg-accent/10",
    activeText: "text-accent-foreground",
  },
  revision: {
    label: "En revision",
    icon: <Eye className="h-3.5 w-3.5" />,
    color: "text-primary",
    activeBg: "bg-primary/10",
    activeText: "text-primary",
  },
  observadas: {
    label: "Observadas",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-destructive",
    activeBg: "bg-destructive/10",
    activeText: "text-destructive",
  },
  todas: {
    label: "Todas",
    icon: <ListFilter className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
    activeBg: "bg-muted",
    activeText: "text-card-foreground",
  },
}

export function BandejaFiltroPage({ filtro, onOpenReview }: BandejaFiltroPageProps) {
  const { solicitudes, markOpenedInFiltro, simularReingreso } = useSolicitudes()
  const [activeTab, setActiveTab] = useState<TabKey>("todas")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAnio, setFilterAnio] = useState("2026")
  const [filterMes, setFilterMes] = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterTipo, setFilterTipo] = useState("todos")
  const [filterSla, setFilterSla] = useState("todos")

  const estadoEnRevision = `En revision DO Filtro ${filtro}` as Estado
  const estadoObservado = `Observado DO Filtro ${filtro}` as Estado

  // All solicitudes belonging to this filtro
  const allFiltroSolicitudes = useMemo(() => {
    return solicitudes.filter(
      (s) => s.estado === estadoEnRevision || s.estado === estadoObservado
    )
  }, [solicitudes, estadoEnRevision, estadoObservado])

  // Classify each solicitud into a tab
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { nuevas: 0, correcciones: 0, revision: 0, observadas: 0, todas: 0 }
    counts.todas = allFiltroSolicitudes.length
    allFiltroSolicitudes.forEach((s) => {
      const tab = classifySolicitud(s, filtro)
      if (tab !== "todas") counts[tab]++
    })
    return counts
  }, [allFiltroSolicitudes, filtro])

  // Apply tab filter + search + column filters
  const filteredSolicitudes = useMemo(() => {
    return allFiltroSolicitudes
      .filter((s) => {
        if (activeTab === "todas") return true
        return classifySolicitud(s, filtro) === activeTab
      })
      .filter((s) => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase()
          return (
            s.folioSolicitud.toLowerCase().includes(term) ||
            s.folioRecepcion?.toLowerCase().includes(term) ||
            s.folioDictamen?.toLowerCase().includes(term) ||
            s.secretaria.toLowerCase().includes(term) ||
            s.tipo.toLowerCase().includes(term)
          )
        }
        return true
      })
      .filter((s) => {
        if (filterAnio !== "todos" && s.fechaRecepcionDO) {
          return s.fechaRecepcionDO.startsWith(filterAnio)
        }
        return true
      })
      .filter((s) => {
        if (filterMes !== "todos" && s.fechaRecepcionDO) {
          return s.fechaRecepcionDO.slice(5, 7) === filterMes
        }
        return true
      })
      .filter((s) => filterSecretaria === "todas" || s.secretaria === filterSecretaria)
      .filter((s) => filterTipo === "todos" || s.tipo === filterTipo)
      .filter((s) => {
        if (filterSla === "todos") return true
        if (filterSla === "vencido" && s.slaRestante !== null) return s.slaRestante <= 0
        if (filterSla === "critico" && s.slaRestante !== null) return s.slaRestante >= 1 && s.slaRestante <= 5
        if (filterSla === "medio" && s.slaRestante !== null) return s.slaRestante >= 6 && s.slaRestante <= 10
        if (filterSla === "bien" && s.slaRestante !== null) return s.slaRestante > 10
        return true
      })
  }, [allFiltroSolicitudes, activeTab, filtro, searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo, filterSla])

  const handleOpenReview = (solId: string) => {
    markOpenedInFiltro(solId, filtro)
    onOpenReview(solId, filtro)
  }

  // Get tab badge for a solicitud row
  const getRowTabBadge = (s: Solicitud) => {
    const tab = classifySolicitud(s, filtro)
    const config = TAB_CONFIG[tab]
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.activeBg} ${config.activeText}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Bandeja DO - {FILTRO_LABELS[filtro]}</h2>
        <p className="text-sm text-muted-foreground">
          Solicitudes asignadas al {FILTRO_LABELS[filtro]} para revision y dictaminacion
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <Filter className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{allFiltroSolicitudes.length}</span>
              <p className="text-xs text-muted-foreground">Total en bandeja</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <CircleDot className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{tabCounts.nuevas}</span>
              <p className="text-xs text-muted-foreground">Nuevas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <RotateCcw className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">{tabCounts.correcciones}</span>
              <p className="text-xs text-muted-foreground">Correcciones</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <span className="text-2xl font-bold text-card-foreground">
                {allFiltroSolicitudes.filter((s) => s.slaRestante !== null && s.slaRestante <= 5).length}
              </span>
              <p className="text-xs text-muted-foreground">SLA en riesgo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1.5 border border-border">
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((tabKey) => {
          const config = TAB_CONFIG[tabKey]
          const count = tabCounts[tabKey]
          const isActive = activeTab === tabKey

          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? `${config.activeBg} ${config.activeText} shadow-sm`
                  : "text-muted-foreground hover:text-card-foreground hover:bg-muted"
              }`}
            >
              {config.icon}
              <span>{config.label}</span>
              <span className={`ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                isActive
                  ? `${config.activeText} bg-background`
                  : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, secretaria o tipo..."
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
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="Prestacion de Servicios">Prestacion de Servicios</SelectItem>
            <SelectItem value="Nombramiento Tiempo Det.">Nombramiento Tiempo Det.</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSla} onValueChange={setFilterSla}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="bien">{'>'} 10 dias</SelectItem>
            <SelectItem value="medio">6 - 10 dias</SelectItem>
            <SelectItem value="critico">1 - 5 dias</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-semibold text-card-foreground">
            <span>{filteredSolicitudes.length} solicitudes en {FILTRO_LABELS[filtro]}</span>
            {activeTab !== "todas" && (
              <Badge className={`${TAB_CONFIG[activeTab].activeBg} ${TAB_CONFIG[activeTab].activeText} border-0 text-xs`}>
                Tab: {TAB_CONFIG[activeTab].label}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Clasificacion</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Folio Recepcion</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Secretaria</th>
                  {filtro >= 2 && (
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Folio Dictamen</th>
                  )}
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Reingreso</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Ult. Observo</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">SLA</th>
                  <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredSolicitudes.length === 0 ? (
                  <tr>
                    <td colSpan={filtro >= 2 ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                      No hay solicitudes en esta clasificacion
                    </td>
                  </tr>
                ) : (
                  filteredSolicitudes.map((sol) => (
                    <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {getRowTabBadge(sol)}
                          {sol.reingresoCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                              <RotateCcw className="h-2.5 w-2.5" />
                              Reingreso #{sol.reingresoCount}
                            </span>
                          )}
                          {sol.lastObservedStage && sol.lastObservedStage !== filtro && sol.reingresoCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Devuelta por Filtro {sol.lastObservedStage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium text-card-foreground">
                        <div className="flex flex-col gap-1">
                          <span>{sol.folioRecepcion || "---"}</span>
                          {sol.folioTemporal && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive w-fit">
                              Folio temporal
                            </span>
                          )}
                          {sol.esRegularizacion && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary w-fit">
                              Regularizacion
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{sol.tipo}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{sol.secretaria}</td>
                      {filtro >= 2 && (
                        <td className="px-3 py-3">
                          {sol.folioDictamen ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
                              {sol.folioDictamen}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">---</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3">
                        {sol.reingresoCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            #{sol.reingresoCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">---</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {sol.lastObservedStage ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-card-foreground">Filtro {sol.lastObservedStage}</span>
                            <span className="text-[10px] text-muted-foreground">{sol.lastObservedDate || ""}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">---</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><SlaIndicator diasRestantes={sol.slaRestante} /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReview(sol.id)}
                            className="text-secondary hover:text-primary gap-1.5"
                          >
                            <FileSearch className="h-4 w-4" />
                            Revisar
                          </Button>
                          {/* Simular reingreso button for observed solicitudes */}
                          {sol.estado === estadoObservado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => simularReingreso(sol.id)}
                              className="text-accent-foreground hover:text-primary gap-1 text-xs"
                              title="Simular que URG corrigio y reenvia"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Simular reingreso
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
