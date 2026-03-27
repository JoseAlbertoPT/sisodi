export const RANGOS_TABULADOR = [
  // Nivel 105
  { min: 38770.56, max: 49846.50, nivel: "105", categoria: "A" },
  { min: 33232.06, max: 38769.50, nivel: "105", categoria: "B" },
  { min: 32124.36, max: 33231.00, nivel: "105", categoria: "C" },
  // Nivel 106
  { min: 27693.56, max: 32123.30, nivel: "106", categoria: "A" },
  { min: 25478.16, max: 27692.50, nivel: "106", categoria: "B" },
  { min: 24380.00, max: 25477.10, nivel: "106", categoria: "C" },

  // Nivel 107
  { min: 22155.06, max: 24369.40, nivel: "107", categoria: "A" },
  { min: 19939.86, max: 22154.00, nivel: "107", categoria: "B" },
  { min: 19080.00, max: 19938.60, nivel: "107", categoria: "C" },

  // Nivel 108
  { min: 16616.56, max: 18830.90, nivel: "108", categoria: "A" },
  { min: 14401.16, max: 16615.50, nivel: "108", categoria: "B" },
  { min: 0.00,     max: 14400.10, nivel: "108", categoria: "C" },

  // Nivel 109
  { min: 12720.00, max: 13292.40, nivel: "109", categoria: "A" },
  { min: 12001.00, max: 12718.94, nivel: "109", categoria: "B" },
  { min: 0.00,     max: 12000.00, nivel: "109", categoria: "C" },

  // Nivel 301
  { min: 11660.00, max: 15898.94, nivel: "301", categoria: "A" },

  // Nivel 302
  { min: 10554.00, max: 11658.94, nivel: "302", categoria: "A" },

  // Nivel 303
  { min: 0.00,     max: 10553.36, nivel: "303", categoria: "A" },

  // SSPC - Nivel 504
  { min: 0.00,     max: 49847.00, nivel: "504", categoria: "ÚNICA" },

  // SSPC - Nivel 505
  { min: 38216.71, max: 47631.00, nivel: "505", categoria: "A" },
  { min: 0.00,     max: 38216.00, nivel: "505", categoria: "B" },

  // SSPC - Nivel 506
  { min: 25830.08, max: 44308.00, nivel: "506", categoria: "A" },
  { min: 0.00,     max: 25829.00, nivel: "506", categoria: "B" },

  // SSPC - Nivel 507
  { min: 22862.08, max: 40985.00, nivel: "507", categoria: "A" },
  { min: 0.00,     max: 22861.00, nivel: "507", categoria: "B" },

  // SSPC - Nivel 508
  { min: 20530.08, max: 36554.00, nivel: "508", categoria: "A" },
  { min: 0.00,     max: 20529.00, nivel: "508", categoria: "B" },

  // SSPC - Nivel 509
  { min: 16556.08, max: 33231.00, nivel: "509", categoria: "A" },
  { min: 0.00,     max: 16554.00, nivel: "509", categoria: "B" },

  // SSPC - Nivel 510
  { min: 16008.01, max: 31569.00, nivel: "510", categoria: "A" },
  { min: 0.00,     max: 16008.00, nivel: "510", categoria: "B" },
]

const fmt = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Devuelve p.ej. "105   $38,770.56 a $49,846.50" o null si no se encuentra */
export function formatRangoTabulador(nivel: string | null | undefined, categoria: string | null | undefined): string | null {
  if (!nivel) return null
  const rango = RANGOS_TABULADOR.find(
    r => r.nivel === nivel && (categoria ? r.categoria === categoria : true)
  )
  if (!rango) return null
  return `${rango.nivel}   ${fmt(rango.min)} a ${fmt(rango.max)}`
}
