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
// consolidado DGSAC (prisma/import-historico-consolidado.ts). Esas ya traen su folio real
// del proceso en papel, así que no deben llevar siglas calculadas encima.
export const MARCA_HISTORICO_IMPORTADO = "Importado de histórico consolidado DGSAC";

export function claveParaPdf(
  secretaria: string | null | undefined,
  folioDictamen: string | null | undefined,
  esHistoricoImportado: boolean,
): string {
  if (esHistoricoImportado) return folioDictamen ?? "";
  return construirClave(secretaria, folioDictamen);
}
