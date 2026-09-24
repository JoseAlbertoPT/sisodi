import type { PrismaClient } from "./generated/prisma"

/**
 * Contenido de la solicitud que el Catálogo necesita para regenerar la Carta
 * Descriptiva y el Dictamen (ver app/api/pdf/carta-descriptiva y
 * dictamen-prestacion, rama `catalogoId`).
 *
 * Antes el registro de catalogo_justificacion solo guardaba folio, vigencia,
 * importe, etc. y dependía de la solicitud vinculada para el resto: si la
 * solicitud se borraba (p. ej. al reimportar con "reemplazar importación
 * anterior"), solicitud_id quedaba en NULL y la carta salía solo con los
 * títulos. Ahora se copia al crear/actualizar el registro del catálogo.
 */
export const CAMPOS_CONTENIDO_CATALOGO = {
  objeto: true,
  actividades: true,
  responsabilidades: true,
  escolaridad: true,
  comp_adm: true,
  comp_tec: true,
  comp_soc: true,
  valores: true,
  areas_exp: true,
  unidad_administrativa: true,
  unidad_responsable: true,
  folio_justificacion: true,
  vigencia_inicio: true,
  vigencia_fin: true,
} as const

/** Lee de la solicitud el contenido a copiar al Catálogo ({} si no existe). */
export async function contenidoParaCatalogo(
  db: Pick<PrismaClient, "solicitud">,
  solicitudId: number,
) {
  const sol = await db.solicitud.findUnique({
    where: { id: solicitudId },
    select: CAMPOS_CONTENIDO_CATALOGO,
  })
  return sol ?? {}
}
