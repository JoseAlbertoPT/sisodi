// ── Calendario de Recepcion – Datos Mock 2026 ──

export interface PeriodoCap3000 {
  mes: string
  limiteDO: string
  limiteDGRH: string
}

export interface PeriodoCap1000 {
  quincena: string
  limiteDO: string
  limiteDGRH: string
}

export const CAP_3000: PeriodoCap3000[] = [
  { mes: "Enero", limiteDO: "07/01/2026", limiteDGRH: "09/01/2026" },
  { mes: "Febrero", limiteDO: "09/01/2026", limiteDGRH: "19/01/2026" },
  { mes: "Marzo", limiteDO: "05/02/2026", limiteDGRH: "16/02/2026" },
  { mes: "Abril", limiteDO: "05/03/2026", limiteDGRH: "17/03/2026" },
  { mes: "Mayo", limiteDO: "03/04/2026", limiteDGRH: "14/04/2026" },
  { mes: "Junio", limiteDO: "04/05/2026", limiteDGRH: "15/05/2026" },
  { mes: "Julio", limiteDO: "03/06/2026", limiteDGRH: "15/06/2026" },
  { mes: "Agosto", limiteDO: "03/07/2026", limiteDGRH: "14/07/2026" },
  { mes: "Septiembre", limiteDO: "04/08/2026", limiteDGRH: "17/08/2026" },
  { mes: "Octubre", limiteDO: "02/09/2026", limiteDGRH: "14/09/2026" },
  { mes: "Noviembre", limiteDO: "02/10/2026", limiteDGRH: "13/10/2026" },
  { mes: "Diciembre", limiteDO: "03/11/2026", limiteDGRH: "17/11/2026" },
]

export const CAP_1000: PeriodoCap1000[] = [
  { quincena: "2da Enero", limiteDO: "07/01/2026", limiteDGRH: "08/01/2026" },
  { quincena: "1ra Febrero", limiteDO: "07/01/2026", limiteDGRH: "19/01/2026" },
  { quincena: "2da Febrero", limiteDO: "21/01/2026", limiteDGRH: "30/02/2026" },
  { quincena: "1ra Marzo", limiteDO: "05/02/2026", limiteDGRH: "16/03/2026" },
  { quincena: "2da Marzo", limiteDO: "18/02/2026", limiteDGRH: "02/03/2026" },
  { quincena: "1ra Abril", limiteDO: "05/03/2026", limiteDGRH: "13/03/2026" },
  { quincena: "2da Abril", limiteDO: "19/03/2026", limiteDGRH: "30/04/2026" },
  { quincena: "1ra Mayo", limiteDO: "03/04/2026", limiteDGRH: "13/04/2026" },
  { quincena: "2da Mayo", limiteDO: "20/04/2026", limiteDGRH: "30/05/2026" },
  { quincena: "1ra Junio", limiteDO: "04/05/2026", limiteDGRH: "15/06/2026" },
  { quincena: "2da Junio", limiteDO: "20/05/2026", limiteDGRH: "01/06/2026" },
  { quincena: "1ra Julio", limiteDO: "03/06/2026", limiteDGRH: "15/06/2026" },
  { quincena: "2da Julio", limiteDO: "18/06/2026", limiteDGRH: "29/06/2026" },
  { quincena: "1ra Agosto", limiteDO: "03/07/2026", limiteDGRH: "14/07/2026" },
  { quincena: "2da Agosto", limiteDO: "21/07/2026", limiteDGRH: "03/08/2026" },
  { quincena: "1ra Septiembre", limiteDO: "04/08/2026", limiteDGRH: "17/08/2026" },
  { quincena: "2da Septiembre", limiteDO: "19/08/2026", limiteDGRH: "31/08/2026" },
  { quincena: "1ra Octubre", limiteDO: "02/09/2026", limiteDGRH: "14/09/2026" },
  { quincena: "2da Octubre", limiteDO: "18/09/2026", limiteDGRH: "29/09/2026" },
  { quincena: "1ra Noviembre", limiteDO: "02/10/2026", limiteDGRH: "13/10/2026" },
  { quincena: "2da Noviembre", limiteDO: "21/10/2026", limiteDGRH: "03/11/2026" },
  { quincena: "1ra Diciembre", limiteDO: "03/11/2026", limiteDGRH: "13/11/2026" },
]

// NUEVO: Nombramiento usa exactamente lo mismo que CAP_1000
export const NOMBRAMIENTO_TD: PeriodoCap1000[] = CAP_1000

/** Parse dd/mm/yyyy to Date */
export function parseDateDMY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number)
  return new Date(y, m - 1, d)
}

// ── Reusable periodo-vigencia check ──

export type RegimenPeriodo = "honorarios" | "asimilados" | "nombramiento"

export interface PeriodoVigenciaResult {
  vigente: boolean
  limiteDO: string | null
}

/**
 * Returns whether the given periodo is still within the DO deadline
 * for the given regimen.  `fechaHoy` defaults to today (midnight).
 */
export function isPeriodoVigente(
  regimen: RegimenPeriodo,
  periodoSeleccionado: string,
  fechaHoy?: Date,
): PeriodoVigenciaResult {
  const today = fechaHoy ?? new Date()
  today.setHours(0, 0, 0, 0)

  let row: { limiteDO: string } | undefined

  if (regimen === "honorarios") {
    row = CAP_3000.find((r) => r.mes === periodoSeleccionado)
  } else {
    // asimilados & nombramiento both use quincena-based tables
    const table = regimen === "asimilados" ? CAP_1000 : NOMBRAMIENTO_TD
    row = table.find((r) => r.quincena === periodoSeleccionado)
  }

  if (!row) return { vigente: false, limiteDO: null }

  const limiteDODate = parseDateDMY(row.limiteDO)
  return { vigente: today <= limiteDODate, limiteDO: row.limiteDO }
}

/**
 * Validates that regimen matches the solicitud tipo.
 * Returns true when they are compatible.
 */
export function isRegimenTipoCompatible(
  regimen: RegimenPeriodo,
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Determinado",
): boolean {
  if (regimen === "nombramiento") return tipo === "Nombramiento Tiempo Determinado"
  return tipo === "Prestacion de Servicios" // honorarios | asimilados
}
