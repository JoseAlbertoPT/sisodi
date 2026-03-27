import datos from "./ua-claves.json"

export type UAClavesRow = {
  "SECRETARÍA": string
  "UA DE CLAVES ADMINISTRATIVAS": string
  "CLAVE REPORTE PLAZAS": string
}

const DATOS: UAClavesRow[] = datos as UAClavesRow[]

/** Lista única de secretarías para autocompletar (campo Secretaría) */
export const SECRETARIAS_UA_CATALOGO: string[] = [
  ...new Set(DATOS.map((r) => r["SECRETARÍA"])),
]

/**
 * Filtra sugerencias de secretaría según lo que escribe el usuario.
 */
export function filtrarSecretarias(input: string): string[] {
  if (!input) return SECRETARIAS_UA_CATALOGO
  const q = input.toLowerCase()
  return SECRETARIAS_UA_CATALOGO.filter((s) => s.toLowerCase().includes(q))
}

/**
 * Devuelve las UA DE CLAVES ADMINISTRATIVAS que corresponden a una secretaría.
 * (Campo UA se habilita solo después de seleccionar secretaría)
 */
export function getUAsForSecretaria(secretaria: string): string[] {
  if (!secretaria) return []
  return DATOS
    .filter((r) => r["SECRETARÍA"] === secretaria)
    .map((r) => r["UA DE CLAVES ADMINISTRATIVAS"])
}

/**
 * Busca el registro exacto por secretaría + UA y devuelve la CLAVE REPORTE PLAZAS.
 * Readonly — se auto-llena al seleccionar la UA.
 *
 * const registro = datos.find(
 *   d => d['SECRETARÍA'] === secretariaSeleccionada &&
 *        d['UA DE CLAVES ADMINISTRATIVAS'] === uaSeleccionada
 * )
 * claveReportePlazas = registro['CLAVE REPORTE PLAZAS']
 */
export function getClaveForUA(secretaria: string, ua: string): string {
  if (!secretaria || !ua) return ""
  const registro = DATOS.find(
    (d) =>
      d["SECRETARÍA"] === secretaria &&
      d["UA DE CLAVES ADMINISTRATIVAS"] === ua
  )
  return registro?.["CLAVE REPORTE PLAZAS"] ?? ""
}
