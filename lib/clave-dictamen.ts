const SIGLAS_STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "en", "para"]);

export function siglasSecretaria(nombre: string | null | undefined): string {
  if (!nombre) return "";
  return nombre
    .trim()
    .split(/\s+/)
    .map((w) => {
      const lw = w.toLowerCase();
      if (lw === "y") return "y";
      if (SIGLAS_STOPWORDS.has(lw)) return "";
      return w.charAt(0).toUpperCase();
    })
    .join("");
}

export function construirClave(secretaria: string | null | undefined, folioDictamen: string | null | undefined): string {
  const siglas = siglasSecretaria(secretaria);
  if (!siglas && !folioDictamen) return "";
  if (!folioDictamen) return siglas;
  return siglas ? `${siglas}/${folioDictamen}` : folioDictamen;
}

// Marca usada en historial_solicitud para las solicitudes cargadas desde el histórico
// consolidado DGSAC (prisma/import-historico-consolidado.ts).
export const MARCA_HISTORICO_IMPORTADO = "Importado de histórico consolidado DGSAC";

// La Clave (carta descriptiva) y la Justificación (dictamen técnico) siempre llevan
// siglas de secretaría + folio de dictamen, sea la solicitud viva o histórico importado.
export function claveParaPdf(
  secretaria: string | null | undefined,
  folioDictamen: string | null | undefined,
  _esHistoricoImportado: boolean,
): string {
  return construirClave(secretaria, folioDictamen);
}
