"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download, BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const concentradoData = [
  { secretaria: "Sec. de Finanzas", total: 32, emitidas: 25, proceso: 5, rechazadas: 2 },
  { secretaria: "Sec. de Educacion", total: 28, emitidas: 20, proceso: 6, rechazadas: 2 },
  { secretaria: "Sec. de Salud", total: 25, emitidas: 18, proceso: 4, rechazadas: 3 },
  { secretaria: "Sec. de Gobierno", total: 22, emitidas: 16, proceso: 5, rechazadas: 1 },
  { secretaria: "Sec. de Obras", total: 20, emitidas: 12, proceso: 6, rechazadas: 2 },
  { secretaria: "Sec. de Desarrollo", total: 15, emitidas: 10, proceso: 3, rechazadas: 2 },
]

const chartData = concentradoData.map((d) => ({
  name: d.secretaria.replace("Sec. de ", ""),
  Emitidas: d.emitidas,
  "En proceso": d.proceso,
  Rechazadas: d.rechazadas,
}))

export function ConcentradoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Concentrado General</h2>
          <p className="text-sm text-muted-foreground">
            Vista consolidada de solicitudes por secretaria
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select defaultValue="2026">
          <SelectTrigger className="w-32 bg-card">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="todos">
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            <SelectItem value="02">Febrero</SelectItem>
            <SelectItem value="01">Enero</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <BarChart3 className="h-4 w-4 text-secondary" />
            Solicitudes por Secretaria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d5cf" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#86857e" }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "#86857e" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #d6d5cf",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Emitidas" fill="#6e795a" radius={[0, 4, 4, 0]} />
                <Bar dataKey="En proceso" fill="#c69c6d" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Rechazadas" fill="#832b56" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            Detalle por Secretaria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-[8px] border border-[#E5E7EB] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Secretaria</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Emitidas</th>
                  <th className="px-4 py-3 text-right font-semibold">En Proceso</th>
                  <th className="px-4 py-3 text-right font-semibold">Rechazadas</th>
                </tr>
              </thead>
              <tbody>
                {concentradoData.map((row) => (
                  <tr key={row.secretaria} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-card-foreground break-words max-w-[220px]">{row.secretaria}</td>
                    <td className="px-4 py-3 text-right text-card-foreground font-semibold">{row.total}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.emitidas}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.proceso}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.rechazadas}</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-4 py-3 text-card-foreground">Total General</td>
                  <td className="px-4 py-3 text-right text-card-foreground">{concentradoData.reduce((s, r) => s + r.total, 0)}</td>
                  <td className="px-4 py-3 text-right text-card-foreground">{concentradoData.reduce((s, r) => s + r.emitidas, 0)}</td>
                  <td className="px-4 py-3 text-right text-card-foreground">{concentradoData.reduce((s, r) => s + r.proceso, 0)}</td>
                  <td className="px-4 py-3 text-right text-card-foreground">{concentradoData.reduce((s, r) => s + r.rechazadas, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
