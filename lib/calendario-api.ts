"use client"

export interface PeriodoCap3000 {
  mes: string
  limiteDO: string
  limiteDGRH: string
  fechaInicio?: string
  fechaFin?: string
}

export interface PeriodoCap1000 {
  quincena: string
  limiteDO: string
  limiteDGRH: string
  fechaInicio?: string
  fechaFin?: string
}

export interface CalendarioResponse {
  honorarios: PeriodoCap3000[]
  asimilados: PeriodoCap1000[]
  nombramiento: PeriodoCap1000[]
}

export async function fetchCalendario(ejercicio: number): Promise<CalendarioResponse> {
  const res = await fetch(`/api/calendario?ejercicio=${ejercicio}`)
  if (!res.ok) throw new Error("Error al cargar calendario")
  return res.json()
}

export async function updateCalendario(
  ejercicio: number,
  data: CalendarioResponse,
): Promise<CalendarioResponse> {
  const res = await fetch(`/api/calendario?ejercicio=${ejercicio}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = Array.isArray(err.message) ? err.message.join("; ") : (err.message ?? "Error al guardar calendario")
    throw new Error(msg)
  }
  return res.json()
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function mesNumero(mes: string): string {
  const idx = MESES.indexOf(mes)
  return idx >= 0 ? String(idx + 1).padStart(2, "0") : "01"
}

export function mesDeQuincena(quincena: string): string {
  return quincena.replace(/^(1ra|2da)\s+/, "")
}

function buildQuincenas(year: number): PeriodoCap1000[] {
  return MESES.flatMap((mes) => {
    const mm = mesNumero(mes)
    const suffix = `/${mm}/${year}`
    const quincenas: PeriodoCap1000[] = []
    if (mes !== "Enero")     quincenas.push({ quincena: `1ra ${mes}`, limiteDO: suffix, limiteDGRH: suffix })
    if (mes !== "Diciembre") quincenas.push({ quincena: `2da ${mes}`, limiteDO: suffix, limiteDGRH: suffix })
    return quincenas
  })
}

export function buildEmptyCalendario(year: number): CalendarioResponse {
  return {
    honorarios: MESES.map((mes) => {
      const mm = mesNumero(mes)
      const suffix = `/${mm}/${year}`
      return { mes, limiteDO: suffix, limiteDGRH: suffix }
    }),
    asimilados: buildQuincenas(year),
    nombramiento: buildQuincenas(year),
  }
}
