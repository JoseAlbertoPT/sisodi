/**
 * Regla 12: el folio de dictamen no debe mostrarse a personas usuarias ni
 * incluirse en documentos descargables hasta que el dictamen tenga la última
 * firma requerida. "Emitido" es el único estado que se alcanza una vez que el
 * proceso de firma está 100% completo (ver app/api/firma-efirma/emitir-dictamen
 * y app/api/firma-efirma/firmar-interno), así que es la fuente única de verdad
 * para esta regla en todo el sistema.
 */
export function puedeMostrarFolioDictamen(estado: string | null | undefined): boolean {
  return (estado ?? "").trim().toLowerCase() === "emitido"
}
