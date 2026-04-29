import datos from "./ua-claves.json"

export type UAClavesRow = {
  "SECRETARÍA": string
  "UA DE CLAVES ADMINISTRATIVAS": string
  "CLAVE REPORTE PLAZAS": string
}

const DATOS: UAClavesRow[] = datos as UAClavesRow[]

export const SECRETARIAS_UA_CATALOGO: string[] = [
  ...new Set(DATOS.map((r) => r["SECRETARÍA"])),
]

export function filtrarSecretarias(input: string): string[] {
  if (!input) return SECRETARIAS_UA_CATALOGO
  const q = input.toLowerCase()
  return SECRETARIAS_UA_CATALOGO.filter((s) => s.toLowerCase().includes(q))
}

export function getUAsForSecretaria(secretaria: string): string[] {
  if (!secretaria) return []
  return DATOS
    .filter((r) => r["SECRETARÍA"] === secretaria)
    .map((r) => r["UA DE CLAVES ADMINISTRATIVAS"])
}

export function getNombreForClave(clave: string): string {
  if (!clave) return ""
  const registro = DATOS.find((d) => d["CLAVE REPORTE PLAZAS"] === clave)
  return registro?.["UA DE CLAVES ADMINISTRATIVAS"] ?? clave
}

export function getClaveForUA(secretaria: string, ua: string): string {
  if (!secretaria || !ua) return ""
  const registro = DATOS.find(
    (d) =>
      d["SECRETARÍA"] === secretaria &&
      d["UA DE CLAVES ADMINISTRATIVAS"] === ua
  )
  return registro?.["CLAVE REPORTE PLAZAS"] ?? ""
}

export function formatClave(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9)
  if (!digits) return ""
  if (digits.length === 9) {
    return [digits[0], digits.slice(1, 3), digits.slice(3, 5), digits[5], digits[6], digits[7], digits[8]].join(" ")
  }
  
  const parts: string[] = []
  if (digits.length >= 1) parts.push(digits[0])
  if (digits.length >= 2) parts.push("0" + digits[1])
  if (digits.length >= 4) parts.push(digits.slice(2, 4))
  else if (digits.length === 3) parts.push(digits[2])
  for (let i = 4; i < digits.length; i++) parts.push(digits[i])
  return parts.join(" ")
}
