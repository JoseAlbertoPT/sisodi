import { addMonths, endOfYear, isBefore, startOfDay } from "date-fns"

/**
 * `new Date("YYYY-MM-DD")` interpreta la cadena como medianoche UTC. En un
 * servidor con timezone detrás de UTC (p. ej. America/Mexico_City, UTC-6),
 * leer esa fecha con métodos locales (getMonth/getDate, o startOfDay de
 * date-fns) la corre un día hacia atrás — un 1 de enero termina viéndose
 * como 31 de diciembre del año anterior. Se parsea a mano como fecha local
 * para que coincida con lo que el usuario seleccionó en el date picker
 * (que ya usa `new Date(y, m - 1, d)`, ver components/ui/date-picker-habil.tsx).
 */
export function parseFechaLocal(v: unknown): Date | null {
  if (!v) return null
  const s = String(v)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Fecha sin hora (columnas @db.Date como vigencia_inicio/vigencia_fin) en
 * DD/MM/AAAA. La API las manda como "2027-01-02T00:00:00.000Z": leerlas con
 * `new Date()` y mostrarlas en hora local las recorre un día hacia atrás
 * (01/01/2027). No usar para timestamps (fecha de creación, envío, etc.).
 */
export function formatFechaSoloDia(v: unknown, vacio = ""): string {
  const d = parseFechaLocal(v)
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : vacio
}

/**
 * Regla de negocio: la vigencia de una carta descriptiva/dictamen no puede
 * exceder 6 meses desde su inicio, y nunca cruza el 31 de diciembre del año
 * en que inició (no hay prórroga automática de un año a otro).
 */
export function calcularVigenciaMaxima(inicio: Date): Date {
  const seisMeses = startOfDay(addMonths(inicio, 6))
  const finDeAnio = startOfDay(endOfYear(inicio))
  return isBefore(seisMeses, finDeAnio) ? seisMeses : finDeAnio
}

/**
 * Un inicio el 31 de diciembre deja un rango de 0 días válidos (la máxima
 * sería el mismo 31 de diciembre), así que se bloquea explícitamente.
 */
export function esInicioSinRangoValido(inicio: Date): boolean {
  return inicio.getMonth() === 11 && inicio.getDate() === 31
}

export const MENSAJE_INICIO_31_DIC =
  "No se puede iniciar la vigencia el 31 de diciembre: no quedaría ningún día dentro del rango permitido. Intente el 1 de enero del año siguiente."

export interface ValidacionVigencia {
  ok: boolean
  error?: string
}

/**
 * Valida solo la regla de rango (6 meses / 31-dic), no que el inicio sea
 * "hoy o después": esa restricción es de UX para captura normal y tiene
 * excepciones legítimas ya existentes en el frontend (edición de borradores,
 * usuarios con permiso especial), así que no se replica aquí como bloqueo
 * duro de backend.
 */
export function validarVigencia(
  inicio: Date,
  fin: Date,
  /** Vigencia extendida del Catálogo (lib/permiso-catalogo.ts): solo hasta el 31 de diciembre, sin el tope de 6 meses. */
  opciones: { sinLimiteSeisMeses?: boolean } = {},
): ValidacionVigencia {
  const inicioDia = startOfDay(inicio)
  const finDia = startOfDay(fin)

  if (esInicioSinRangoValido(inicioDia)) {
    return { ok: false, error: MENSAJE_INICIO_31_DIC }
  }
  if (isBefore(finDia, inicioDia)) {
    return { ok: false, error: "La fecha de término de vigencia no puede ser anterior a la fecha de inicio." }
  }
  const maxima = opciones.sinLimiteSeisMeses ? startOfDay(endOfYear(inicioDia)) : calcularVigenciaMaxima(inicioDia)
  if (isBefore(maxima, finDia)) {
    return {
      ok: false,
      error: opciones.sinLimiteSeisMeses
        ? "La fecha de término de vigencia no puede pasar del 31 de diciembre del año de inicio."
        : "La fecha de término de vigencia excede el máximo permitido (6 meses, sin cruzar el 31 de diciembre del año de inicio).",
    }
  }
  return { ok: true }
}
