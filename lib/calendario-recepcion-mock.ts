

export interface PeriodoCap3000 {
  mes: string
  fechaFin: string   
  limiteDO: string
  limiteDGRH: string
}

export interface PeriodoCap1000 {
  quincena: string
  fechaFin: string   
  limiteDO: string
  limiteDGRH: string
}

export type RegimenPeriodo = "honorarios" | "asimilados" | "nombramiento"

export interface PeriodoVigenciaResult {
  vigente: boolean
  limiteDO: string | null
}

export const CAP_3000: PeriodoCap3000[] = [
  { mes: "Enero",      fechaFin: "31/01/2026", limiteDO: "07/01/2026", limiteDGRH: "09/01/2026" },
  { mes: "Febrero",    fechaFin: "28/02/2026", limiteDO: "09/01/2026", limiteDGRH: "19/01/2026" },
  { mes: "Marzo",      fechaFin: "31/03/2026", limiteDO: "05/02/2026", limiteDGRH: "16/02/2026" },
  { mes: "Abril",      fechaFin: "30/04/2026", limiteDO: "05/03/2026", limiteDGRH: "17/03/2026" },
  { mes: "Mayo",       fechaFin: "31/05/2026", limiteDO: "03/04/2026", limiteDGRH: "14/04/2026" },
  { mes: "Junio",      fechaFin: "30/06/2026", limiteDO: "04/05/2026", limiteDGRH: "15/05/2026" },
  { mes: "Julio",      fechaFin: "31/07/2026", limiteDO: "03/06/2026", limiteDGRH: "15/06/2026" },
  { mes: "Agosto",     fechaFin: "31/08/2026", limiteDO: "03/07/2026", limiteDGRH: "14/07/2026" },
  { mes: "Septiembre", fechaFin: "30/09/2026", limiteDO: "04/08/2026", limiteDGRH: "17/08/2026" },
  { mes: "Octubre",    fechaFin: "31/10/2026", limiteDO: "02/09/2026", limiteDGRH: "14/09/2026" },
  { mes: "Noviembre",  fechaFin: "30/11/2026", limiteDO: "02/10/2026", limiteDGRH: "13/10/2026" },
  { mes: "Diciembre",  fechaFin: "31/12/2026", limiteDO: "03/11/2026", limiteDGRH: "17/11/2026" },
]

export const CAP_1000: PeriodoCap1000[] = [
  { quincena: "2da Enero",       fechaFin: "31/01/2026", limiteDO: "07/01/2026", limiteDGRH: "08/01/2026" },
  { quincena: "1ra Febrero",     fechaFin: "15/02/2026", limiteDO: "07/01/2026", limiteDGRH: "19/01/2026" },
  { quincena: "2da Febrero",     fechaFin: "28/02/2026", limiteDO: "21/01/2026", limiteDGRH: "30/02/2026" },
  { quincena: "1ra Marzo",       fechaFin: "15/03/2026", limiteDO: "05/02/2026", limiteDGRH: "16/03/2026" },
  { quincena: "2da Marzo",       fechaFin: "31/03/2026", limiteDO: "18/02/2026", limiteDGRH: "02/03/2026" },
  { quincena: "1ra Abril",       fechaFin: "15/04/2026", limiteDO: "05/03/2026", limiteDGRH: "13/03/2026" },
  { quincena: "2da Abril",       fechaFin: "30/04/2026", limiteDO: "19/03/2026", limiteDGRH: "30/04/2026" },
  { quincena: "1ra Mayo",        fechaFin: "15/05/2026", limiteDO: "03/04/2026", limiteDGRH: "13/04/2026" },
  { quincena: "2da Mayo",        fechaFin: "31/05/2026", limiteDO: "20/04/2026", limiteDGRH: "30/05/2026" },
  { quincena: "1ra Junio",       fechaFin: "15/06/2026", limiteDO: "04/05/2026", limiteDGRH: "15/06/2026" },
  { quincena: "2da Junio",       fechaFin: "30/06/2026", limiteDO: "20/05/2026", limiteDGRH: "01/06/2026" },
  { quincena: "1ra Julio",       fechaFin: "15/07/2026", limiteDO: "03/06/2026", limiteDGRH: "15/06/2026" },
  { quincena: "2da Julio",       fechaFin: "31/07/2026", limiteDO: "18/06/2026", limiteDGRH: "29/06/2026" },
  { quincena: "1ra Agosto",      fechaFin: "15/08/2026", limiteDO: "03/07/2026", limiteDGRH: "14/07/2026" },
  { quincena: "2da Agosto",      fechaFin: "31/08/2026", limiteDO: "21/07/2026", limiteDGRH: "03/08/2026" },
  { quincena: "1ra Septiembre",  fechaFin: "15/09/2026", limiteDO: "04/08/2026", limiteDGRH: "17/08/2026" },
  { quincena: "2da Septiembre",  fechaFin: "30/09/2026", limiteDO: "19/08/2026", limiteDGRH: "31/08/2026" },
  { quincena: "1ra Octubre",     fechaFin: "15/10/2026", limiteDO: "02/09/2026", limiteDGRH: "14/09/2026" },
  { quincena: "2da Octubre",     fechaFin: "31/10/2026", limiteDO: "18/09/2026", limiteDGRH: "29/09/2026" },
  { quincena: "1ra Noviembre",   fechaFin: "15/11/2026", limiteDO: "02/10/2026", limiteDGRH: "13/10/2026" },
  { quincena: "2da Noviembre",   fechaFin: "30/11/2026", limiteDO: "21/10/2026", limiteDGRH: "03/11/2026" },
  { quincena: "1ra Diciembre",   fechaFin: "15/12/2026", limiteDO: "03/11/2026", limiteDGRH: "13/11/2026" },
]

export const NOMBRAMIENTO_TD: PeriodoCap1000[] = CAP_1000

export function parseDateDMY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number)
  return new Date(y, m - 1, d)
}

export function getPeriodoEndDate(
  regimen: RegimenPeriodo,
  periodoSeleccionado: string,
): Date | null {
  if (regimen === "honorarios") {
    const row = CAP_3000.find((r) => r.mes === periodoSeleccionado)
    return row ? parseDateDMY(row.fechaFin) : null
  }
  const table = regimen === "asimilados" ? CAP_1000 : NOMBRAMIENTO_TD
  const row = table.find((r) => r.quincena === periodoSeleccionado)
  return row ? parseDateDMY(row.fechaFin) : null
}

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
    const table = regimen === "asimilados" ? CAP_1000 : NOMBRAMIENTO_TD
    row = table.find((r) => r.quincena === periodoSeleccionado)
  }

  if (!row) return { vigente: false, limiteDO: null }

  const limiteDODate = parseDateDMY(row.limiteDO)
  return { vigente: today <= limiteDODate, limiteDO: row.limiteDO }
}

export function isRegimenTipoCompatible(
  regimen: RegimenPeriodo,
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Det.",
): boolean {
  if (regimen === "nombramiento") return tipo === "Nombramiento Tiempo Det."
  return tipo === "Prestacion de Servicios"
}
