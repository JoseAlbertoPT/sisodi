import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}
const CAPITALIZE_RE =
  /([.!?]\s+)(?!(?:art|arts|fracc|frac|num|sr|sra|dr|dra|lic|ing|mtro|mtra|prof|profa|etc|fig|col|mpio|edo|vo|bo|ap|inc|ref|vs|tel|cel|gral|atte)\b)([a-záéíóúüñ])/g
function restoreAccents(text: string): string {
  let r = text.normalize("NFC")
  r = r.replace(/cion(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]|$)/gi, "ción")
  r = r.replace(/sion(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]|$)/gi, "sión")
  r = r.replace(/(?<![cs])ion(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]|$)/gi, "ión")
  r = r.replace(/\btambien\b/gi, "también")
  r = r.replace(/\bademas\b/gi, "además")
  r = r.replace(/\bdespues\b/gi, "después")
  r = r.replace(/\bsegun\b/gi, "según")
  r = r.replace(/\baqui\b/gi, "aquí")
  r = r.replace(/\balli\b/gi, "allí")
  r = r.replace(/\bahi\b/gi, "ahí")
  r = r.replace(/\btraves\b/gi, "través")
  r = r.replace(/\bdemas\b/gi, "demás")
  r = r.replace(/\bjamas\b/gi, "jamás")
  r = r.replace(/\basi\b/gi, "así")
  return r
}

export function applyTextRules(text: string): string {
  if (!text) return text
  let result = text.trim()
  if (!result) return result
  const lettersOnly = result.replace(/[^A-Za-záéíóúüñÁÉÍÓÚÜÑ]/g, "")
  if (lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase()) {
    result = result.toLowerCase()
  }

  result = restoreAccents(result)
  result = result.charAt(0).toUpperCase() + result.slice(1)
  result = result.replace(
    CAPITALIZE_RE,
    (_m, punctSpace: string, char: string) => punctSpace + char.toUpperCase()
  )

  return result
}

export function applyTextRulesArray(items: string[]): string[] {
  return items.map(applyTextRules)
}
