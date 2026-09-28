import fs from "fs"
import path from "path"
import { Font } from "@react-pdf/renderer"

const FONT_DIR = path.join(process.cwd(), "public", "fonts")

let hyphenationRegistrada = false

/**
 * Por default react-pdf parte palabras largas por sílaba para que quepan en
 * el ancho disponible (ej. "JUSTIFICACIÓN" → "JUSTIFI-CACIÓN" en el título
 * del encabezado del Dictamen). Registrar un callback que devuelve la
 * palabra completa como una sola unidad desactiva ese corte silábico: la
 * palabra entera pasa al siguiente renglón en vez de partirse con guion.
 */
export function registerPdfNoHyphenation(): void {
  if (hyphenationRegistrada) return
  Font.registerHyphenationCallback((word) => [word])
  hyphenationRegistrada = true
}

/**
 * Ruta al .otf de QuetzalliSans que se debe registrar como fuente de todos
 * los documentos (Dictamen, Justificación, Cartas Descriptivas,
 * Nombramiento). Solo existe el peso Thin en el repo por ahora — en cuanto
 * se agregue public/fonts/QuetzalliSans-Regular.otf, esta función lo
 * detecta y lo usa automáticamente, sin tocar código.
 */
export function resolveQuetzalliSansPath(): string | null {
  const regular = path.join(FONT_DIR, "QuetzalliSans-Regular.otf")
  if (fs.existsSync(regular)) return regular
  const thin = path.join(FONT_DIR, "QuetzalliSans-Thin.otf")
  if (fs.existsSync(thin)) return thin
  return null
}

/**
 * Peso Bold de QuetzalliSans para títulos y subtítulos. No es un archivo
 * oficial: se generó a partir de QuetzalliSans-Thin engrosando el contorno de
 * cada glifo (FreeType FT_Outline_Embolden, +12 unidades de 1000), porque
 * react-pdf no puede negritar una fuente por sí solo. Si llega el Bold
 * oficial, basta con reemplazar el archivo.
 */
export function resolveQuetzalliSansBoldPath(): string | null {
  const bold = path.join(FONT_DIR, "QuetzalliSans-Bold.otf")
  return fs.existsSync(bold) ? bold : null
}
