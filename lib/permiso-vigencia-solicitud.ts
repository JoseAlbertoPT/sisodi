import { endOfYear, startOfDay } from "date-fns"

// Permiso "Captura nueva solicitud": para un régimen y mes/quincena de
// aplicación, el usuario puede capturar una solicitud nueva con vigencia de
// más de 6 meses (hasta el 31 de diciembre del año en que inicia). Es de un
// solo uso y se consume cuando la vigencia realmente pasa de los 6 meses; la
// solicitud queda marcada con `vigencia_extendida` para poder editarse después.
//
// Se guarda en permiso_captura con régimen "vig-<régimen>" (para no
// confundirse con la captura extemporánea del mismo régimen y periodo) y el
// mes/quincena como periodo.

export type RegimenBase = "honorarios" | "asimilados" | "nombramiento"
export type RegimenPermisoVigencia = `vig-${RegimenBase}`

const PREFIJO = "vig-"

export function regimenPermisoVigencia(regimen: RegimenBase): RegimenPermisoVigencia {
  return `${PREFIJO}${regimen}`
}

export function esPermisoVigenciaSolicitud(p: { regimen: string }): boolean {
  return p.regimen.startsWith(PREFIJO)
}

/** Régimen legible del permiso ("vig-honorarios" → "honorarios"). */
export function regimenDePermisoVigencia(regimen: string): string {
  return regimen.startsWith(PREFIJO) ? regimen.slice(PREFIJO.length) : regimen
}

/** Vigencia máxima con el permiso: hasta el 31 de diciembre del año de inicio. */
export function vigenciaMaximaExtendida(inicio: Date): Date {
  return startOfDay(endOfYear(inicio))
}
