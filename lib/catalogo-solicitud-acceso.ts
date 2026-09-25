import { prisma } from "@/lib/prisma"
import { ROLES_SOLICITUD_CATALOGO_TODAS } from "@/lib/api-guard"

const secretariaRaiz = (s: string | null | undefined) => (s ?? "").split(">")[0].trim().toLowerCase()

export interface AlcanceSolicitudesCatalogo {
  /** Administrador/Emisor: todas las secretarías (y quienes dan la segunda firma). */
  verTodas: boolean
  esCentralizada: boolean
  secretaria: string
}

export async function alcanceSolicitudesCatalogo(userId: string): Promise<AlcanceSolicitudesCatalogo> {
  const viewer = await prisma.usuario.findUnique({
    where:  { id: userId },
    select: {
      secretaria_texto:    true,
      organo_centralizado: { select: { nombre: true } },
      rol:                 { select: { nombre: true } },
    },
  })
  return {
    verTodas:       ROLES_SOLICITUD_CATALOGO_TODAS.includes(viewer?.rol?.nombre ?? ""),
    esCentralizada: !!viewer?.organo_centralizado,
    secretaria:     secretariaRaiz(viewer?.secretaria_texto ?? viewer?.organo_centralizado?.nombre),
  }
}

/**
 * Pestaña Solicitud: Administrador/Emisor ven las de todas las secretarías,
 * UEFA solo las de la suya; todos acotados a su ámbito (centralizado /
 * paraestatal).
 */
export function dentroDeAlcance(
  alcance: AlcanceSolicitudesCatalogo,
  cj: { tipo_administracion: string | null; secretaria: string | null; solicitud: { secretaria: string | null } | null },
): boolean {
  const esParaestatal = cj.tipo_administracion === "paraestatal"
  if (alcance.esCentralizada === esParaestatal) return false
  if (alcance.verTodas) return true
  return !!alcance.secretaria && secretariaRaiz(cj.secretaria ?? cj.solicitud?.secretaria) === alcance.secretaria
}

export const catalogoDictamenPdfKey = (catalogoSolicitudId: number) =>
  `catalogo-dictamenes/${catalogoSolicitudId}.pdf`
