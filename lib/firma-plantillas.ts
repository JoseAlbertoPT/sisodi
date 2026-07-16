import { prisma } from "@/lib/prisma"

export type FirmanteTipo = "externo" | "interno"
export type FirmanteBandeja = "uefa" | "revision" | "validacion" | "emision"

export interface FirmanteTemplate {
  orden: number
  rol: string
  cargo: string
  tipo: FirmanteTipo
  bandeja?: FirmanteBandeja
}

const PRESTACION_SERVICIOS: FirmanteTemplate[] = [
  {
    orden: 1, rol: "Elaboró", tipo: "externo",
    cargo: "Persona Titular de la Unidad Administrativa u Organismo Auxiliar",
  },
  {
    orden: 2, rol: "Revisó (UEFA)", tipo: "interno", bandeja: "uefa",
    cargo: "Persona Titular de la Unidad de Enlace Financiero Administrativo o Equivalente",
  },
  {
    orden: 3, rol: "Revisó", tipo: "interno", bandeja: "revision",
    cargo: "Persona responsable de la revisión de la Justificación",
  },
  {
    orden: 4, rol: "Verificó", tipo: "interno", bandeja: "validacion",
    cargo: "Persona Titular de la Dirección de Análisis Normativo y Funcional",
  },
  {
    orden: 5, rol: "Emitió", tipo: "interno", bandeja: "emision",
    cargo: "Persona Titular de la Dirección General de Desarrollo Organizacional",
  },
]

const NOMBRAMIENTO_TIEMPO_DET: FirmanteTemplate[] = [
  {
    orden: 1, rol: "Vo. Bo.", tipo: "externo",
    cargo: "Titular de la Unidad de Enlace Jurídico o Equivalente",
  },
  {
    orden: 2, rol: "Elaboró", tipo: "externo",
    cargo: "Persona Titular de la Unidad Administrativa u Organismo Auxiliar",
  },
  {
    orden: 3, rol: "Revisó (UEFA)", tipo: "interno", bandeja: "uefa",
    cargo: "Persona Titular de la Unidad de Enlace Financiero Administrativo o Equivalente",
  },
  {
    orden: 4, rol: "Revisó", tipo: "interno", bandeja: "revision",
    cargo: "Persona responsable de la revisión de la Justificación",
  },
  {
    orden: 5, rol: "Verificó", tipo: "interno", bandeja: "validacion",
    cargo: "Persona Titular de la Dirección de Análisis Normativo y Funcional",
  },
  {
    orden: 6, rol: "Emitió", tipo: "interno", bandeja: "emision",
    cargo: "Persona Titular de la Dirección General de Desarrollo Organizacional",
  },
]

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

export function plantillaFirmantes(tipoSolicitud: string | null | undefined): FirmanteTemplate[] {
  if (!tipoSolicitud) return PRESTACION_SERVICIOS
  const t = norm(tipoSolicitud)
  if (t.includes("nombramiento")) return NOMBRAMIENTO_TIEMPO_DET
  return PRESTACION_SERVICIOS
}

export interface UsuariosInternosResueltos {
  revisor_id: string | null
  validador_id: string | null
  emisor_id: string | null
}

/**
 * Identifica quiénes aprobaron en cada bandeja consultando historial_solicitud.
 * - Revisor (Filtro 1): quien transicionó a "En Validacion Final"
 * - Validador (Filtro 2): quien transicionó a "En Revision Emisor"
 * - Emisor (Filtro 3): quien transicionó a "Pendiente Firma Dictamen" o "Emitido"
 */
export async function resolverUsuariosInternos(solicitudId: number): Promise<UsuariosInternosResueltos> {
  const historial = await prisma.historial_solicitud.findMany({
    where: { solicitud_id: solicitudId },
    include: { estado_historial_solicitud_estado_nuevo_idToestado: true },
    orderBy: { fecha: "asc" },
  })

  const matchNombre = (entry: any, nombres: string[]) => {
    const n = entry?.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
    return nombres.some(x => norm(x) === norm(n))
  }

  const revisorEntry  = historial.find(h => matchNombre(h, ["En Validacion Final"]))
  const validadorEntry = historial.find(h => matchNombre(h, ["En Revision Emisor"]))
  const emisorEntry   = historial.find(h => matchNombre(h, ["Pendiente Firma Dictamen", "Pendiente Firma Justificacion", "Emitido"]))

  return {
    revisor_id:   revisorEntry?.usuario_id    ?? null,
    validador_id: validadorEntry?.usuario_id  ?? null,
    emisor_id:    emisorEntry?.usuario_id     ?? null,
  }
}

/**
 * Resuelve el usuario_id para una entrada de plantilla interna, según su bandeja.
 * Devuelve null si es externo o si no se encontró al interno en el historial.
 */
export function usuarioIdParaFirmante(
  template: FirmanteTemplate,
  creadoPorId: string,
  internos: UsuariosInternosResueltos,
): string | null {
  if (template.tipo !== "interno") return null
  switch (template.bandeja) {
    case "uefa":       return creadoPorId
    case "revision":   return internos.revisor_id
    case "validacion": return internos.validador_id
    case "emision":    return internos.emisor_id
    default:           return null
  }
}
