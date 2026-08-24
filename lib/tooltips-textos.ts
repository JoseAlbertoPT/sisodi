/**
 * Textos de todos los tooltips (`InfoTooltip`) del sistema, en un solo lugar.
 * Cuando el área responsable entregue la redacción definitiva de un texto,
 * basta con actualizar su valor aquí — no hay que tocar los componentes que
 * lo usan.
 *
 * Los que ya traen una redacción completa son textos provisionales que ya
 * están en producción, pendientes de validación oficial. Los que dicen
 * "[Texto pendiente por definir]" son tooltips nuevos sin ningún borrador
 * todavía: solo marcan dónde va a ir el texto.
 */
export const TOOLTIPS = {
  VIGENCIA:
    "La fecha de inicio se calcula a partir del día de la solicitud. La fecha de término puede seleccionarse hasta 6 meses después, sin exceder el 31 de diciembre del año en curso.",
  MAX_PRESTADORES:
    "El Número Máximo de Prestadores de Servicio depende de la Secretaría / dependencias seleccionada.",
  TABULADOR: "[Texto pendiente por definir]",
  UNIDAD_RESPONSABLE: "[Texto pendiente por definir]",
  PROGRAMA_PROYECTO: "[Texto pendiente por definir]",
} as const
