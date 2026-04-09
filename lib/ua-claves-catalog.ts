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

/**
 * Formatea una clave de reporte de plazas con el patrón [1,2,2,1,1,1,1].
 * Para ≤8 dígitos el 2do grupo se rellena con cero a la izquierda.
 * Ejemplo: "12400000" → "1 02 40 0 0 0 0"
 */
export function formatClave(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9)
  if (!digits) return ""
  if (digits.length === 9) {
    return [digits[0], digits.slice(1, 3), digits.slice(3, 5), digits[5], digits[6], digits[7], digits[8]].join(" ")
  }
  // ≤8 dígitos: el 2do grupo (1 dígito raw) se rellena con cero → "0X"
  const parts: string[] = []
  if (digits.length >= 1) parts.push(digits[0])
  if (digits.length >= 2) parts.push("0" + digits[1])
  if (digits.length >= 4) parts.push(digits.slice(2, 4))
  else if (digits.length === 3) parts.push(digits[2])
  for (let i = 4; i < digits.length; i++) parts.push(digits[i])
  return parts.join(" ")
}
