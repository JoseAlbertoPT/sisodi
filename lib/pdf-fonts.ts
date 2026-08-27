import fs from "fs"
import path from "path"

const FONT_DIR = path.join(process.cwd(), "public", "fonts")

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
