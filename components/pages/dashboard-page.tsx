"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Briefcase,
  FileQuestion,
  UserCheck,
  FileOutput,
  Users,
  Clock,
  AlertTriangle,
  Eye,
  FileSearch,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  useSolicitudes,
  getEstadoVariant,
  getSlaColor,
  getSlaBackground,
  getSlaLabel,
  type Estado,
} from "@/lib/solicitudes-store"
import type { PageKey } from "@/components/app-sidebar"

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void
  onOpenReview: (solicitudId: string, filtro: 1 | 2 | 3) => void
}

const PIE_COLORS = ["#283c2a", "#c69c6d"]

function EstadoBadge({ estado }: { estado: Estado }) {
  const variant = getEstadoVariant(estado)
  return (
    <Badge className={`${variant.bg} ${variant.text} hover:${variant.bg} border-0 text-xs`}>
      {estado}
    </Badge>
  )
}

function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  const color = getSlaColor(diasRestantes)
  const bg = getSlaBackground(diasRestantes)
  const label = getSlaLabel(diasRestantes)

  if (diasRestantes === null) return <span className="text-xs text-muted-foreground">---</span>

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  )
}

export function DashboardPage({ onNavigate, onOpenReview }: DashboardPageProps) {
  const { solicitudes } = useSolicitudes()

  const stats = useMemo(() => {
    const total = solicitudes.length
    const emitidos = solicitudes.filter((s) => s.estado === "Emitido").length
    const enProceso = solicitudes.filter(
      (s) =>
        s.estado !== "Borrador" &&
        s.estado !== "Emitido" &&
        !s.estado.startsWith("Observado")
    ).length
    const honorarios = solicitudes.filter((s) => s.tipo === "Prestacion de Servicios").length
    const honorariosAsimilados = solicitudes.filter((s) => s.tipo === "Honorarios Asimilados").length
    const nombramiento = solicitudes.filter((s) => s.tipo === "Nombramiento Tiempo Det.").length
    const prestadores = new Set(solicitudes.map((s) => s.prestador)).size

    return { total, emitidos, enProceso, honorarios, honorariosAsimilados, nombramiento, prestadores }
  }, [solicitudes])

  const kpis = [
    {
      label: "Total de solicitudes recibidas",
      value: stats.total,
      icon: FileText,
      color: "bg-[#2d4a2d]",        // verde oscuro — igual que imagen
    },
    {
      label: "Justificaciones por honorarios",
      value: stats.honorarios,
      icon: Briefcase,
      color: "bg-[#4a5c2d]",        // verde oliva
    },
    {
      label: "Justificaciones por honorarios asimilados a salarios",
      value: stats.honorariosAsimilados,
      icon: FileQuestion,
      color: "bg-[#b5883a]",        // dorado/ocre
    },
    {
      label: "Justificaciones por nombramiento por tiempo determinado",
      value: stats.nombramiento,
      icon: UserCheck,
      color: "bg-[#3a5c3a]",        // verde medio
    },
    {
      label: "Justificaciones emitidas",
      value: stats.emitidos,
      icon: FileOutput,
      color: "bg-[#c57a2a]",        // naranja/ámbar
    },
    {
      label: "Numero de prestadores de servicio",
      value: stats.prestadores,
      icon: Users,
      color: "bg-[#3a5c3a]",        // verde
    },
    {
      label: "Justificaciones en proceso",
      value: stats.enProceso,
      icon: Clock,
      color: "bg-[#5a5c4a]",        // verde grisáceo
    },
  ]

  const barData = [
    { mes: "Ene", solicitudes: 85 },
    { mes: "Feb", solicitudes: solicitudes.length },
    { mes: "Mar", solicitudes: 0 },
  ]

  const pieData = [
    { name: "Prestacion de Servicios", value: solicitudes.filter((s) => s.tipo === "Prestacion de Servicios").length },
    { name: "Nombramiento Tiempo Det.", value: solicitudes.filter((s) => s.tipo === "Nombramiento Tiempo Det.").length },
  ]

  const recentSolicitudes = [...solicitudes]
    .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
    .slice(0, 8)

  const slaRiesgo = solicitudes
    .filter((s) => s.slaRestante !== null && s.slaRestante <= 5)
    .sort((a, b) => (a.slaRestante ?? 99) - (b.slaRestante ?? 99))

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tablero Informativo</h2>
        <p className="text-sm text-muted-foreground">
          Resumen general del sistema de dictaminacion
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select defaultValue="2026">
          <SelectTrigger className="w-32 bg-card">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="todos">
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            <SelectItem value="01">Enero</SelectItem>
            <SelectItem value="02">Febrero</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-sm border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.color}`}>
                <kpi.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-card-foreground">{kpi.value}</span>
                <span className="text-xs text-muted-foreground leading-tight">{kpi.label}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA en riesgo alert */}
      {slaRiesgo.length > 0 && (
        <Card className="shadow-sm border-destructive/30 border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Solicitudes con Plazo en Riesgo ({slaRiesgo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Folio Recepcion</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Secretaria</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Estado</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Días Restantes</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {slaRiesgo.map((sol) => {
                    const filtroMatch = sol.estado.match(/Filtro (\d)/)
                    const filtroNum = filtroMatch ? (parseInt(filtroMatch[1]) as 1 | 2 | 3) : 1
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-3 py-2 font-medium text-card-foreground">{sol.folioRecepcion}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sol.secretaria}</td>
                        <td className="px-3 py-2"><EstadoBadge estado={sol.estado} /></td>
                        <td className="px-3 py-2"><SlaIndicator diasRestantes={sol.slaRestante} /></td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenReview(sol.id, filtroNum)}
                            className="text-secondary hover:text-primary gap-1"
                          >
                            <FileSearch className="h-4 w-4" />
                            Revisar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Solicitudes por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6d5cf" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#86857e" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#86857e" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #d6d5cf",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="solicitudes" fill="#283c2a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Distribucion por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #d6d5cf",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Solicitudes Recientes
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("mis-solicitudes")}
              className="text-xs text-secondary hover:text-primary"
            >
              Ver todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Folio</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Folio DO</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Secretaria</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">SLA</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Accion</th>
                </tr>
              </thead>
              <tbody>
                {recentSolicitudes.map((sol) => (
                  <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-card-foreground">{sol.folioSolicitud}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sol.folioRecepcion || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sol.secretaria}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sol.tipo}</td>
                    <td className="px-4 py-3"><EstadoBadge estado={sol.estado} /></td>
                    <td className="px-4 py-3"><SlaIndicator diasRestantes={sol.slaRestante} /></td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-secondary hover:text-primary gap-1.5">
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}