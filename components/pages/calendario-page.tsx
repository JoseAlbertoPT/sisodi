"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Pencil, FileUp, Info } from "lucide-react"
import { CAP_3000, CAP_1000, NOMBRAMIENTO_TD } from "@/lib/calendario-recepcion-mock"

type TabRecepcion = "honorarios" | "asimilados" | "nombramiento"

export function CalendarioPage() {
  const [tabRecepcion, setTabRecepcion] = useState<TabRecepcion>("honorarios")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Calendario de Recepción</h2>
        <p className="text-sm text-muted-foreground">
          Periodo de aceptación y fechas límite para la recepción de solicitudes - Ejercicio 2026
        </p>
      </div>

      {/* ── Calendario de Recepcion (Periodo de Aceptacion) ── */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <CalendarDays className="h-5 w-5 text-secondary" />
                Calendario de Recepción (Periodo de Aceptación)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Fechas límite para la recepción de solicitudes de dictaminación - Ejercicio 2026
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                <Pencil className="h-3.5 w-3.5" />
                Editar calendario
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                <FileUp className="h-3.5 w-3.5" />
                Importar (Excel/PDF)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTabRecepcion("honorarios")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${tabRecepcion === "honorarios"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              Honorarios
            </button>

            <button
              onClick={() => setTabRecepcion("asimilados")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${tabRecepcion === "asimilados"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              Honorarios asimilados a salarios
            </button>

            <button
              onClick={() => setTabRecepcion("nombramiento")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${tabRecepcion === "nombramiento"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              Nombramiento por tiempo determinado
            </button>
          </div>

          {/* Table Cap 3000 */}
          {tabRecepcion === "honorarios" && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-card-foreground">Mes de aplicación</th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de dictámen/opiniónes técnicas funcionales (DGDO)
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CAP_3000.map((row, idx) => (
                    <tr
                      key={row.mes}
                      className={`border-t border-border ${idx % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-card-foreground">{row.mes}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDO}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDGRH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Cap 1000 */}
          {tabRecepcion === "asimilados" && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-card-foreground">Quincena de aplicación</th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de dictámen/opiniónes técnicas funcionales (DGDO)
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CAP_1000.map((row, idx) => (
                    <tr
                      key={row.quincena}
                      className={`border-t border-border ${idx % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-card-foreground">{row.quincena}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDO}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDGRH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}



          {tabRecepcion === "nombramiento" && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-card-foreground">Quincena de aplicación</th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de dictámen/opiniónes técnicas funcionales (DGDO)
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-card-foreground">
                      Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {NOMBRAMIENTO_TD.map((row, idx) => (
                    <tr
                      key={row.quincena}
                      className={`border-t border-border ${idx % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-card-foreground">{row.quincena}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDO}</td>
                      <td className="px-4 py-2.5 text-center text-card-foreground">{row.limiteDGRH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Footer note */}
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2.5">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-xs text-muted-foreground">
              Información de referencia. Cambios sujetos a validación administrativa.
            </span>
          </div>


        </CardContent>
      </Card>
    </div>
  )
}