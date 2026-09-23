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

/**
 * Busca el rango del tabulador para un nivel/categoría (y, si se da, la
 * Secretaría). Si no hay coincidencia exacta de categoría pero el nivel tiene
 * una sola categoría aplicable, se usa esa: solicitudes capturadas antes de
 * que el tabulador cambiara sus categorías (p. ej. guardadas con "A" cuando
 * hoy el nivel solo tiene "UNICA") siguen encontrando su rango. Si el nivel
 * tiene varias categorías no se adivina.
 */
export function buscarRangoTabulador(
  rangos: RangoTabulador[],
  nivel: string | null | undefined,
  categoria: string | null | undefined,
  secretaria?: string | null,
): RangoTabulador | null {
  if (!nivel) return null
  const delNivel = rangos.filter(
    r => r.nivel === nivel && (secretaria === undefined || secretariaAplica(r.secretarias, secretaria))
  )
  if (!categoria) return delNivel[0] ?? null
  const exacto = delNivel.find(r => r.categoria === categoria)
  if (exacto) return exacto
  return new Set(delNivel.map(r => r.categoria)).size === 1 ? delNivel[0] : null
}

export function formatRangoTabulador(
  rangos: RangoTabulador[],
  nivel: string | null | undefined,
  categoria: string | null | undefined,
): string | null {
  const rango = buscarRangoTabulador(rangos, nivel, categoria)
  if (!rango) return null
  return `${rango.nivel}   ${fmt(rango.min)} a ${fmt(rango.max)}`
}
