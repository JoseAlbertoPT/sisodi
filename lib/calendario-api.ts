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

/** Años que ya tienen calendario guardado. */
export async function fetchEjercicios(): Promise<number[]> {
  const res = await fetch("/api/calendario/ejercicios")
  if (!res.ok) throw new Error("Error al cargar los años del calendario")
  const json = await res.json()
  return Array.isArray(json.ejercicios) ? json.ejercicios : []
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

/** "DD/MM/YYYY" → misma fecha `delta` años después. 29/02 pasa a 28/02 si el año nuevo no es bisiesto. */
function desplazarAnio(fecha: string | undefined, delta: number): string | undefined {
  if (!fecha) return fecha
  const [d, m, y] = fecha.split("/")
  const anio = Number(y)
  if (!m || !y || isNaN(anio)) return fecha
  const nuevoAnio = anio + delta
  if (!d) return `/${m}/${nuevoAnio}`
  const ultimoDia = new Date(nuevoAnio, Number(m), 0).getDate()
  const dia = Math.min(Number(d), ultimoDia)
  return `${String(dia).padStart(2, "0")}/${m}/${nuevoAnio}`
}

/**
 * Calendario de `year` precargado con las fechas de `anterior` (el año
 * `anioAnterior`): mismo día y mes, en el año que corresponde. Los periodos
 * que no existían en el anterior quedan vacíos, igual que en buildEmptyCalendario.
 */
export function buildCalendarioDesdeAnterior(
  anterior: CalendarioResponse,
  anioAnterior: number,
  year: number,
): CalendarioResponse {
  const delta = year - anioAnterior
  const base = buildEmptyCalendario(year)
  const copiar = <T extends PeriodoCap3000 | PeriodoCap1000>(vacio: T, previo: T | undefined): T =>
    !previo
      ? vacio
      : {
          ...vacio,
          limiteDO:    desplazarAnio(previo.limiteDO, delta) ?? vacio.limiteDO,
          limiteDGRH:  desplazarAnio(previo.limiteDGRH, delta) ?? vacio.limiteDGRH,
          fechaInicio: desplazarAnio(previo.fechaInicio, delta),
          fechaFin:    desplazarAnio(previo.fechaFin, delta),
        }
  return {
    honorarios:   base.honorarios.map((r) => copiar(r, anterior.honorarios.find((p) => p.mes === r.mes))),
    asimilados:   base.asimilados.map((r) => copiar(r, anterior.asimilados.find((p) => p.quincena === r.quincena))),
    nombramiento: base.nombramiento.map((r) => copiar(r, anterior.nombramiento.find((p) => p.quincena === r.quincena))),
  }
}
