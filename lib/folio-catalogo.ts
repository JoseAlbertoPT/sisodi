import type { Prisma } from "./generated/prisma"

/**
 * Folio actual del dictamen al reutilizar o cancelar desde el Catálogo:
 * NN/MM/AAAA-TIPO, donde NN es un consecutivo GLOBAL (todas las secretarías y
 * paraestatales) que se reinicia cada mes, y TIPO sale del régimen:
 * CH = Honorarios, CA = Honorarios Asimilados a Salarios.
 */
export type TipoFolioCatalogo = "CH" | "CA"

// CH y CA comparten el consecutivo mensual. Si se separan, el índice único de
// catalogo_solicitud (folio_anio, folio_mes, folio_consecutivo) debe incluir
// también folio_tipo.
export const CONTADOR_CH_CA_COMPARTIDO = true

// El mes del folio es el de la fecha de generación, en hora de Morelos.
const ZONA_HORARIA_FOLIO = "America/Mexico_City"

export function tipoFolioPorRegimen(regimen: string | null | undefined): TipoFolioCatalogo | null {
  const r = (regimen ?? "").toLowerCase()
  if (r.includes("asimilad")) return "CA"
  if (r.includes("honorario")) return "CH"
  return null
}

export function mesAnioFolio(fecha: Date): { mes: number; anio: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA_FOLIO, year: "numeric", month: "numeric" }).formatToParts(fecha)
  return {
    mes: Number(partes.find((p) => p.type === "month")?.value),
    anio: Number(partes.find((p) => p.type === "year")?.value),
  }
}

/** Al menos 2 dígitos; de 100 en adelante sigue creciendo (100/09/2026-CH). */
export function formatearFolioCatalogo(consecutivo: number, mes: number, anio: number, tipo: TipoFolioCatalogo): string {
  return `${String(consecutivo).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}-${tipo}`
}

export interface FolioCatalogo {
  folio: string
  folio_consecutivo: number
  folio_mes: number
  folio_anio: number
  folio_tipo: TipoFolioCatalogo
}

/**
 * Toma el siguiente consecutivo del mes con una sola sentencia atómica
 * (INSERT … ON CONFLICT DO UPDATE … RETURNING): dos generaciones simultáneas
 * nunca reciben el mismo número. Debe llamarse dentro de la misma transacción
 * que guarda el folio, para que un error no deje huecos en la numeración.
 */
export async function generarFolioCatalogo(
  tx: Prisma.TransactionClient,
  tipo: TipoFolioCatalogo,
  fecha: Date = new Date(),
): Promise<FolioCatalogo> {
  const { mes, anio } = mesAnioFolio(fecha)
  const clave = CONTADOR_CH_CA_COMPARTIDO ? "CAT" : `CAT-${tipo}`
  const filas = await tx.$queryRaw<{ consecutivo: number }[]>`
    INSERT INTO consecutivo_folio (tipo, mes, anio, consecutivo)
    VALUES (${clave}, ${mes}, ${anio}, 1)
    ON CONFLICT (tipo, mes, anio)
    DO UPDATE SET consecutivo = COALESCE(consecutivo_folio.consecutivo, 0) + 1
    RETURNING consecutivo
  `
  const consecutivo = Number(filas[0]?.consecutivo)
  if (!Number.isInteger(consecutivo) || consecutivo < 1) throw new Error("No se pudo generar el folio del Catálogo")
  return {
    folio: formatearFolioCatalogo(consecutivo, mes, anio, tipo),
    folio_consecutivo: consecutivo,
    folio_mes: mes,
    folio_anio: anio,
    folio_tipo: tipo,
  }
}
