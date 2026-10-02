import { endOfYear, startOfDay } from "date-fns"

// Permiso "Captura catálogo": a un usuario UEFA se le autoriza, para un folio
// de dictamen específico del Catálogo, reutilizarlo con una vigencia mayor a
// 6 meses (hasta el 31 de diciembre del año en que inicia). Es de un solo
// uso: se consume cuando la reutilización realmente pasa de los 6 meses.
//
// Se guarda en permiso_captura con régimen "catalogo" y un periodo
// "Catálogo <id> · <folio>" (el folio solo es para mostrarlo).

export const REGIMEN_PERMISO_CATALOGO = "catalogo"

export function prefijoPermisoCatalogo(catalogoId: number): string {
  return `Catálogo ${catalogoId} ·`
}

export function periodoPermisoCatalogo(catalogoId: number, folio: string | null | undefined): string {
  return `${prefijoPermisoCatalogo(catalogoId)} ${folio?.trim() || "sin folio"}`.slice(0, 50)
}

export function esPermisoCatalogo(p: { regimen: string }): boolean {
  return p.regimen === REGIMEN_PERMISO_CATALOGO
}

/** Folio legible del permiso (lo que va después del "·"). */
export function folioDePermisoCatalogo(periodo: string): string {
  return periodo.split("·").slice(1).join("·").trim() || periodo
}

/** Vigencia máxima con el permiso: hasta el 31 de diciembre del año de inicio (misma regla que validarVigencia con sinLimiteSeisMeses). */
export function vigenciaMaximaCatalogoExtendida(inicio: Date): Date {
  return startOfDay(endOfYear(inicio))
}
