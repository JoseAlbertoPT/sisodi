import { addMonths, endOfYear, isBefore, startOfDay } from "date-fns"

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
export function validarVigencia(inicio: Date, fin: Date): ValidacionVigencia {
  const inicioDia = startOfDay(inicio)
  const finDia = startOfDay(fin)

  if (esInicioSinRangoValido(inicioDia)) {
    return { ok: false, error: MENSAJE_INICIO_31_DIC }
  }
  if (isBefore(finDia, inicioDia)) {
    return { ok: false, error: "La fecha de término de vigencia no puede ser anterior a la fecha de inicio." }
  }
  const maxima = calcularVigenciaMaxima(inicioDia)
  if (isBefore(maxima, finDia)) {
    return {
      ok: false,
      error: "La fecha de término de vigencia excede el máximo permitido (6 meses, sin cruzar el 31 de diciembre del año de inicio).",
    }
  }
  return { ok: true }
}
