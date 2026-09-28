/**
 * Convierte un importe capturado como texto a número, aceptando tanto el
 * formato mexicano ("$1,300.50") como el europeo ("1.300,50").
 *
 * - Con coma y punto: el que aparece al final es el separador decimal.
 * - Con un solo tipo de separador: si el último grupo tiene 1 o 2 dígitos es
 *   decimal ("348,00" = 348, "$20,000,00" = 20000); si tiene 3, todos son de
 *   miles ("12,000" = 12000, "1.300.000" = 1300000).
 * - Si el texto trae un "TOTAL" ("RECURSO ESTATAL $10,227.23, ... TOTAL: $20,454.46")
 *   se toma el importe que sigue a esa palabra.
 *
 * Devuelve null si el texto está vacío o no contiene un número.
 */
export function parseImporteTexto(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null

  let texto = raw
  const idxTotal = texto.toUpperCase().lastIndexOf("TOTAL")
  if (idxTotal >= 0) texto = texto.slice(idxTotal + "TOTAL".length)

  // Solo el primer número: "$348.00 por hora" → "348.00".
  const s = texto.replace(/\s+/g, "").match(/\d[\d.,]*/)?.[0]?.replace(/[.,]+$/, "")
  if (!s) return null

  const lastComma = s.lastIndexOf(",")
  const lastDot   = s.lastIndexOf(".")
  let normalized: string

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? s.replace(/\./g, "").replace(/,(?=\d*$)/, ".")
      : s.replace(/,/g, "")
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : "."
    const decimales = s.length - s.lastIndexOf(sep) - 1
    const partes = s.split(sep)
    normalized = decimales <= 2
      ? partes.slice(0, -1).join("") + "." + partes[partes.length - 1]
      : partes.join("")
  } else {
    normalized = s
  }

  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}
