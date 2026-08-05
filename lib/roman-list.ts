const ROMAN_VALUES: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(num: number): string {
  let n = num;
  let result = "";
  for (const [value, symbol] of ROMAN_VALUES) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

// Quita el numeral romano de origen (I., II., III., ...) solo si está al
// inicio de la línea. Es limpieza de presentación únicamente: el valor
// quitado nunca se lee ni se reutiliza para decidir la numeración final —
// esa siempre la genera `toRoman` según la posición del ítem en la lista,
// para que un dato de origen mal capturado (numerales repetidos, faltantes
// o en otro formato) no pueda romper la salida.
export function stripLeadingRomanNumeral(line: string): string {
  return line.replace(/^[IVXLCDM]+\.\s*/i, "");
}

// Limpia y renumera una lista de actividades/responsabilidades: descarta el
// numeral romano de origen de cada ítem y genera uno propio, consecutivo,
// según la posición del ítem ya limpio dentro de la lista.
//
// `format` (p. ej. applyTextRules de lib/utils.ts) se aplica al CONTENIDO ya sin numeral,
// nunca al ítem final con numeral incluido: aplicarlo después de anteponer
// "II. "/"III. " lo destruiría, porque una transformación de texto que solo
// conoce "primera letra en mayúscula" no distingue un numeral romano de
// varias letras (II, III, IV...) de una palabra normal y lo dejaría como
// "Ii."/"Iii.".
export function buildRomanNumberedList(
  items: string[],
  clean: (item: string) => string = (item) => item,
  format: (item: string) => string = (item) => item,
): string[] {
  return items
    .map((item) => stripLeadingRomanNumeral(clean(item)).trim())
    .filter((item) => item.length > 0)
    .map((item) => format(item))
    .map((item, i) => `${toRoman(i + 1)}. ${item}`);
}
