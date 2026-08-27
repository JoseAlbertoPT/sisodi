import { normalizeText } from "@/lib/utils"

export type RangoTabulador = {
  min: number
  max: number
  nivel: string
  categoria: string
  /** [] = aplica a todas las Secretarías. No vacío = solo a las nombradas ahí. */
  secretarias: string[]
}

const fmt = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Si `rango.secretarias` está vacío, aplica a cualquier Secretaría. Si no,
 * solo aplica cuando `secretariaActual` coincide (comparación sin acentos ni
 * mayúsculas) con alguna de las nombradas — ver "Secretaria /Dependencia"
 * en la pestaña Tabulador.
 */
export function secretariaAplica(secretariasRango: string[], secretariaActual: string | null | undefined): boolean {
  if (secretariasRango.length === 0) return true
  if (!secretariaActual) return false
  const normActual = normalizeText(secretariaActual)
  return secretariasRango.some((s) => normalizeText(s) === normActual)
}

export function formatRangoTabulador(
  rangos: RangoTabulador[],
  nivel: string | null | undefined,
  categoria: string | null | undefined,
): string | null {
  if (!nivel) return null
  const rango = rangos.find(
    r => r.nivel === nivel && (categoria ? r.categoria === categoria : true)
  )
  if (!rango) return null
  return `${rango.nivel}   ${fmt(rango.min)} a ${fmt(rango.max)}`
}
