"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Check, X,
  CalendarPlus, ChevronDown, AlertCircle,
  CalendarDays, FileText, Rows3, Wallet,
} from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { TabuladorTabContent } from "@/components/tabulador-tab-content"
import { NotaTabContent } from "@/components/nota-tab-content"
import { TiposPagoTabContent } from "@/components/tipos-pago-tab-content"
import { useCalendario } from "@/lib/calendario-store"
import { updateCalendario, fetchCalendario, fetchEjercicios, buildEmptyCalendario, buildCalendarioDesdeAnterior, mesNumero, mesDeQuincena, type CalendarioResponse } from "@/lib/calendario-api"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerHabil, dmyToDate, dateToDmy } from "@/components/ui/date-picker-habil"
type TabRecepcion = "honorarios" | "asimilados" | "nombramiento"
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const QUINCENA_NAMES: string[] = MESES.flatMap((mes) => {
  const qs: string[] = []
  if (mes !== "Enero") qs.push(`1ra ${mes}`)
  if (mes !== "Diciembre") qs.push(`2da ${mes}`)
  return qs
})
const MESES_CORTO: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
}
function DayMonthInput({
  value,
  mesName,
  year,
  onChange,
}: {
  value: string
  mesName: string
  year: number
  onChange: (fullDate: string) => void
}) {
  const parts = value.split("/")
  const day = parts.length === 3 && !value.startsWith("/") ? (parts[0] ?? "") : ""
  const currentMonth = parts.length === 3 ? (parts[1] ?? mesNumero(mesName)) : mesNumero(mesName)
  const hasDayValue = day.length > 0
  const buildDate = (d: string, m: string) => {
    return d ? `${d}/${m}/${year}` : `/${m}/${year}`
  }
  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2)
    if (raw === "") { onChange(buildDate("", currentMonth)); return }
    const num = parseInt(raw, 10)
    if (num < 1 || num > 31) return
    onChange(buildDate(raw, currentMonth))
  }
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(buildDate(day, e.target.value))
  }
  return (
    <div className={`
      inline-flex items-center h-9 rounded-lg text-sm transition-colors
      border bg-background
      ${hasDayValue ? "border-secondary/40" : "border-input"}
      focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary/20
    `}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={day}
        onChange={handleDayChange}
        placeholder="dd"
        className="w-10 h-full text-center bg-transparent outline-none font-semibold text-card-foreground placeholder:text-muted-foreground/50 placeholder:font-normal"
      />
      <span className="text-muted-foreground/40">/</span>
      <div className="relative">
        <select
          value={currentMonth}
          onChange={handleMonthChange}
          className="appearance-none h-full bg-transparent outline-none text-xs font-medium text-card-foreground pl-2 pr-5 cursor-pointer"
        >
          {MESES.map((m, i) => {
            const num = String(i + 1).padStart(2, "0")
            return <option key={m} value={num}>{MESES_CORTO[num]}</option>
          })}
        </select>
        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" strokeWidth={1.25} />
      </div>
      <span className="text-muted-foreground/40">/</span>
      <span className="pr-3 text-xs text-muted-foreground tabular-nums">{year}</span>
    </div>
  )
}

function DateCell({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground/40">--/--/----</span>
  const parts = value.split("/")
  if (parts.length !== 3) return <span className="text-card-foreground">{value}</span>
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-card-foreground">{parts[0]}</span>
      <span className="text-muted-foreground/50">/</span>
      <span className="text-card-foreground">{parts[1]}</span>
      <span className="text-muted-foreground/50">/</span>
      <span className="text-muted-foreground">{parts[2]}</span>
    </span>
  )
}
export function CalendarioPage() {
  const { toast } = useToast()
  const {
    ejercicio, setEjercicio,
    honorarios, asimilados, nombramiento,
    loading, error, refetch,
  } = useCalendario()
  const [tabRecepcion, setTabRecepcion] = useState<TabRecepcion>("honorarios")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<CalendarioResponse | null>(null)
  const isEmpty = !loading && honorarios.length === 0 && asimilados.length === 0 && nombramiento.length === 0
  const tieneFechas = (c: CalendarioResponse | null): c is CalendarioResponse =>
    !!c && c.honorarios.length + c.asimilados.length + c.nombramiento.length > 0
  const handleCreateYear = async (year: number = ejercicio) => {
    const anioAnterior = year - 1
    let anterior: CalendarioResponse | null = null
    try {
      anterior = await fetchCalendario(anioAnterior)
    } catch {  }
    const tieneAnterior = tieneFechas(anterior)
    setEditData(tieneAnterior ? buildCalendarioDesdeAnterior(anterior!, anioAnterior, year) : buildEmptyCalendario(year))
    setEditing(true)
    toast({
      title: `Año ${year}`,
      description: tieneAnterior
        ? `Se cargaron las fechas de ${anioAnterior}. Ajuste las que cambien y presione Guardar.`
        : "Complete solo el día en cada campo y presione Guardar.",
    })
  }
  const handleStartEdit = () => {
    setEditData({
      honorarios: MESES.map((mes) =>
        honorarios.find((r) => r.mes === mes) ?? { mes, limiteDO: "", limiteDGRH: "", fechaInicio: "", fechaFin: "" }
      ),
      asimilados: QUINCENA_NAMES.map((q) =>
        asimilados.find((r) => r.quincena === q) ?? { quincena: q, limiteDO: "", limiteDGRH: "", fechaInicio: "", fechaFin: "" }
      ),
      nombramiento: QUINCENA_NAMES.map((q) =>
        nombramiento.find((r) => r.quincena === q) ?? { quincena: q, limiteDO: "", limiteDGRH: "", fechaInicio: "", fechaFin: "" }
      ),
    })
    setEditing(true)
  }
  const handleCancelEdit = () => { setEditData(null); setEditing(false) }
  const handleSaveEdit = async () => {
    if (!editData) return
    const payload: CalendarioResponse = {
      honorarios: editData.honorarios.filter((r) => r.limiteDO.trim() && r.limiteDGRH.trim()),
      asimilados: editData.asimilados.filter((r) => r.limiteDO.trim() && r.limiteDGRH.trim()),
      nombramiento: editData.nombramiento.filter((r) => r.limiteDO.trim() && r.limiteDGRH.trim()),
    }
    if (payload.honorarios.length === 0 && payload.asimilados.length === 0 && payload.nombramiento.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Debe completar al menos una fila con ambas fechas para guardar." })
      return
    }
    setSaving(true)
    try {
      await updateCalendario(ejercicio, payload)
      toast({ title: "Calendario guardado", description: "Los cambios se guardaron correctamente." })
      await refetch()
      setEditData(null)
      setEditing(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: e instanceof Error ? e.message : "No se pudo guardar el calendario" })
    } finally {
      setSaving(false)
    }
  }
  const updateEditRow = (
    regimen: "honorarios" | "asimilados" | "nombramiento",
    key: string,
    field: "limiteDO" | "limiteDGRH" | "fechaInicio" | "fechaFin",
    value: string,
  ) => {
    if (!editData) return
    setEditData((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      if (regimen === "honorarios") {
        next.honorarios = next.honorarios.map((r) => r.mes !== key ? r : { ...r, [field]: value })
      } else if (regimen === "asimilados") {
        next.asimilados = next.asimilados.map((r) => r.quincena !== key ? r : { ...r, [field]: value })
      } else {
        next.nombramiento = next.nombramiento.map((r) => r.quincena !== key ? r : { ...r, [field]: value })
      }
      return next
    })
  }
  const [availableYears, setAvailableYears] = useState<number[]>(() => [new Date().getFullYear()])
  const agregarAnios = (anios: number[]) =>
    setAvailableYears((prev) => [...new Set([...prev, ...anios])].sort((a, b) => a - b))
  useEffect(() => {
    fetchEjercicios().then(agregarAnios).catch(() => {})
  }, [])
  useEffect(() => { agregarAnios([ejercicio]) }, [ejercicio])
  const [showNewYearInput, setShowNewYearInput] = useState(false)
  const [newYearValue, setNewYearValue] = useState("")
  const [mainTab, setMainTab] = useState<"calendario" | "nota" | "tabulador" | "tipos-pago">("calendario")
  const handleAddYear = async () => {
    const year = parseInt(newYearValue, 10)
    if (!year || year < 2020 || year > 2099) {
      toast({ variant: "destructive", title: "Año inválido", description: "Ingrese un año entre 2020 y 2099." })
      return
    }
    if (availableYears.includes(year)) {
      toast({ variant: "destructive", title: "Año duplicado", description: `El año ${year} ya existe en la lista.` })
      return
    }
    agregarAnios([year])
    setEjercicio(year)
    setNewYearValue("")
    setShowNewYearInput(false)
    let existente: CalendarioResponse | null = null
    try {
      existente = await fetchCalendario(year)
    } catch {  }
    if (!tieneFechas(existente)) await handleCreateYear(year)
  }
  const displayData = editing && editData ? editData : { honorarios, asimilados, nombramiento }
  const quincenaOrder = (q: string) => {
    const mitad = q.startsWith("1ra") ? 0 : 1
    const mes = q.replace(/^(1ra|2da)\s+/, "")
    return MESES.indexOf(mes) * 2 + mitad
  }
  const honorariosSorted = MESES.map((mes) =>
    displayData.honorarios.find((r) => r.mes === mes) ?? { mes, limiteDO: "", limiteDGRH: "" }
  )
  const buildSortedQuincenas = (rows: typeof displayData.asimilados) =>
    QUINCENA_NAMES
      .map((q) => rows.find((r) => r.quincena === q) ?? { quincena: q, limiteDO: "", limiteDGRH: "" })
      .sort((a, b) => quincenaOrder(a.quincena) - quincenaOrder(b.quincena))
  const asimiladosSorted   = buildSortedQuincenas(displayData.asimilados)
  const nombramientoSorted = buildSortedQuincenas(displayData.nombramiento)
  const filledCount = {
    honorarios: displayData.honorarios.filter((r) => r.limiteDO && !r.limiteDO.startsWith("/")).length,
    asimilados: displayData.asimilados.filter((r) => r.limiteDO && !r.limiteDO.startsWith("/")).length,
    nombramiento: displayData.nombramiento.filter((r) => r.limiteDO && !r.limiteDO.startsWith("/")).length,
  }
  return (
    <PageLayout
      title={
        mainTab === "nota"
          ? "Nota del Dictamen Técnico Funcional y de la Justificación de Prestación de Servicios"
          : mainTab === "tabulador"
            ? "Tabulador"
            : mainTab === "tipos-pago"
            ? "Tipos de pago"
            : "Calendario de Recepción"
      }
      description={
        mainTab === "nota"
          ? "Este texto se imprime automáticamente en ambos documentos al guardar."
          : mainTab === "tabulador"
            ? "Niveles, categorías e importes brutos usados en la Equivalencia al Tabulador."
            : mainTab === "tipos-pago"
            ? "Opciones del campo Tipo de Pago en Nueva Solicitud y si aplica la Equivalencia al Tabulador."
            : `Periodo de aceptación y fechas límite para la recepción de solicitudes — Ejercicio ${ejercicio}`
      }
      >
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "calendario" | "nota" | "tabulador" | "tipos-pago")} className="w-full gap-4">
        <TabsList>

          <TabsTrigger value="calendario" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />Calendario
          </TabsTrigger>

          <TabsTrigger value="tabulador" className="gap-1.5">
            <Rows3 className="h-4 w-4" />Tabulador
          </TabsTrigger>

          <TabsTrigger value="tipos-pago" className="gap-1.5">
            <Wallet className="h-4 w-4" />Tipos de pago
          </TabsTrigger>

          <TabsTrigger value="nota" className="gap-1.5">
            <FileText className="h-4 w-4" />Nota
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!loading && (!isEmpty || editing) ? (
            <FilterTabs
              value={tabRecepcion}
              onValueChange={(v) => setTabRecepcion(v as TabRecepcion)}
              items={[
                { value: "honorarios", label: "Honorarios", count: filledCount.honorarios || undefined },
                { value: "asimilados", label: "Honorarios asimilados a salarios", count: filledCount.asimilados || undefined },
                { value: "nombramiento", label: "Nombramiento por tiempo determinado", count: filledCount.nombramiento || undefined },
              ]}
            />
          ) : <div />}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(ejercicio)} onValueChange={(v) => setEjercicio(Number(v))} disabled={editing}>
              <SelectTrigger className="w-[100px] h-9 py-2 text-xs font-mono"><SelectValue placeholder="Año" /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {!editing ? (
              isEmpty ? (
                <Button size="sm" className="gap-1.5 text-xs h-9" onClick={() => void handleCreateYear()} disabled={loading}>
                  <CalendarPlus className="h-3.5 w-3.5" />Crear año {ejercicio}
                </Button>
              ) : (
                <Button variant="default" size="sm" className="text-xs h-9" onClick={handleStartEdit} disabled={loading}>
                  Editar fechas
                </Button>
              )
            ) : (
              <>
                <Button size="sm" variant="primary" className="gap-1.5 text-xs h-9" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Guardar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs h-9"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <X className="h-3 w-3" />Cancelar
                </Button>
              </>
            )}
            {!editing && !showNewYearInput && <div className="h-5 w-px bg-border" />}
            {!editing && !showNewYearInput && (
              <Button size="sm" variant="primary" className="gap-1.5 text-xs h-9" onClick={() => setShowNewYearInput(true)}>
                Nuevo año
              </Button>
            )}
            {showNewYearInput && (
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1">
                <Input type="number" min={2020} max={2099} placeholder="2027" value={newYearValue}
                  onChange={(e) => setNewYearValue(e.target.value)}
                  className="w-20 h-7 text-xs text-center border-0 bg-transparent shadow-none font-mono"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddYear(); if (e.key === "Escape") setShowNewYearInput(false) }}
                />
                <Button size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => void handleAddYear()}><Check className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => setShowNewYearInput(false)}><X className="h-3 w-3" /></Button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {loading && !editData && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            <span className="text-sm text-muted-foreground">Cargando calendario...</span>
          </div>
        )}

        {isEmpty && !editing && !loading && (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-5 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10">
                <CalendarPlus className="h-7 w-7 text-secondary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold text-card-foreground">Sin calendario para {ejercicio}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Cree el calendario para generar automáticamente los 12 meses y 24 quincenas. Solo deberá completar el día de cada fecha límite.
                </p>
              </div>
              <Button variant="primary" className="gap-2" onClick={() => void handleCreateYear()}>
                <CalendarPlus className="h-4 w-4" />Crear calendario {ejercicio}
              </Button>
            </CardContent>
          </Card>
        )}
        {!loading && (!isEmpty || editing) && (
          <>
            {editing && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[#ecf2ff] px-4 py-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3266cb]">
                  <span className="text-[12px] font-bold text-white leading-none">i</span>
                </div>
                <span className="text-sm font-light text-[#3266cb]">
                  En Modo Edición — Ingrese el día en cada celda. El mes y año se asignan automáticamente.
                </span>
              </div>
            )}

            {tabRecepcion === "honorarios" && (
              <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
                <table className="w-full min-w-[640px] text-sm table-fixed">
                  <thead>
                    <tr className="bg-bg-base text-content-high">
                      <th className="px-5 py-3 text-left font-semibold align-middle w-1/5">Mes de aplicación</th>
                      <th className="px-5 py-3 text-center font-semibold align-middle w-2/5 leading-snug text-balance">
                        Fecha límite de recepción de solicitudes de dictamen/opiniones técnicas funcionales (DGDO)
                      </th>
                      <th className="px-5 py-3 text-center font-semibold align-middle w-2/5 leading-snug text-balance">
                        Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH)
                      </th>
                    </tr>
                  </thead>
                  <tbody>

                  {honorariosSorted.map((row, idx) => (
                      <tr key={row.mes} className={`border-t border-border/60 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} ${!editing && row.limiteDO && !row.limiteDO.startsWith("/") ? "hover:bg-muted/40" : ""}`}>
                        <td className="px-5 py-3 align-middle"><span className="font-medium text-card-foreground">{row.mes}</span></td>
                        {editing ? (
                          <>
                            <td className="px-3 py-2 text-center align-middle">
                              <DatePickerHabil
                                value={dmyToDate(row.limiteDO)}
                                defaultMonth={new Date(ejercicio, MESES.indexOf(row.mes), 1)}
                                onChange={(d) => updateEditRow("honorarios", row.mes, "limiteDO", d ? dateToDmy(d) : "")}
                                className="w-36"
                                compact
                              />
                            </td>
                            <td className="px-3 py-2 text-center align-middle">
                              <DatePickerHabil
                                value={dmyToDate(row.limiteDGRH)}
                                defaultMonth={new Date(ejercicio, MESES.indexOf(row.mes), 1)}
                                onChange={(d) => updateEditRow("honorarios", row.mes, "limiteDGRH", d ? dateToDmy(d) : "")}
                                className="w-36"
                                compact
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-center align-middle"><DateCell value={row.limiteDO} /></td>
                            <td className="px-5 py-3 text-center align-middle"><DateCell value={row.limiteDGRH} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(tabRecepcion === "asimilados" || tabRecepcion === "nombramiento") && (
              <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
                <table className="w-full min-w-[640px] text-sm table-fixed">

                  <thead>
                    <tr className="bg-bg-base text-content-high">
                      <th className="px-5 py-3 text-left font-semibold align-middle w-1/5">Quincena de aplicación</th>
                      <th className="px-5 py-3 text-center font-semibold align-middle w-2/5 leading-snug text-balance">
                        Fecha límite de recepción de solicitudes de dictamen/opiniones técnicas funcionales (DGDO)
                      </th>
                      <th className="px-5 py-3 text-center font-semibold align-middle w-2/5 leading-snug text-balance">
                        Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(tabRecepcion === "asimilados" ? asimiladosSorted : nombramientoSorted).map((row, idx) => (
                      <tr key={row.quincena} className={`border-t border-border/60 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} ${!editing && row.limiteDO && !row.limiteDO.startsWith("/") ? "hover:bg-muted/40" : ""}`}>
                        <td className="px-5 py-3 align-middle"><span className="font-medium text-card-foreground">{row.quincena}</span></td>
                        {editing ? (
                          <>
                            <td className="px-3 py-2 text-center align-middle">
                              <DatePickerHabil
                                value={dmyToDate(row.limiteDO)}
                                defaultMonth={new Date(ejercicio, MESES.indexOf(mesDeQuincena(row.quincena)), 1)}
                                onChange={(d) => updateEditRow(tabRecepcion, row.quincena, "limiteDO", d ? dateToDmy(d) : "")}
                                className="w-36"
                                compact
                              />
                            </td>
                            <td className="px-3 py-2 text-center align-middle">
                              <DatePickerHabil
                                value={dmyToDate(row.limiteDGRH)}
                                defaultMonth={new Date(ejercicio, MESES.indexOf(mesDeQuincena(row.quincena)), 1)}
                                onChange={(d) => updateEditRow(tabRecepcion, row.quincena, "limiteDGRH", d ? dateToDmy(d) : "")}
                                className="w-36"
                                compact
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-center align-middle"><DateCell value={row.limiteDO} /></td>
                            <td className="px-5 py-3 text-center align-middle"><DateCell value={row.limiteDGRH} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
             <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4 shrink-0 opacity-40" />
              <span className="text-xs font-bold text-black leading-relaxed">
                Información de referencia. Los cambios están sujetos a validación administrativa.
                {!editing && !isEmpty && (
                  <> — {filledCount.honorarios} meses, {filledCount.asimilados} quincenas asimiladas, {filledCount.nombramiento} quincenas de nombramiento configuradas.</>
                )}
              </span>
            </div>
          </>
        )}
      </div>
        </TabsContent>
        <TabsContent value="tabulador">
          <TabuladorTabContent />
        </TabsContent>
        <TabsContent value="tipos-pago">
          <TiposPagoTabContent />
        </TabsContent>

        <TabsContent value="nota">
          <NotaTabContent />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
