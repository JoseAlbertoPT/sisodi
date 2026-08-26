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
    orden: 2, rol: "Revisó", tipo: "interno", bandeja: "uefa",
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
    orden: 3, rol: "Revisó", tipo: "interno", bandeja: "uefa",
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

/**
 * Nombre del estado de `solicitud` que corresponde a "sigue pendiente de
 * firma, y el siguiente firmante interno que falta está en esta bandeja".
 * Compartido entre /api/firma-efirma/firmar-interno (firmante interno firma)
 * y /api/firma-efirma/firmar (firmante externo firma) para que el avance de
 * estado tras cada firma sea idéntico sin importar qué ruta lo dispara.
 */
export const ESTADO_POR_BANDEJA_PENDIENTE: Record<FirmanteBandeja, string> = {
  uefa:       "Pendiente Firma Justificacion",
  revision:   "Pendiente Firma Revision",
  validacion: "Pendiente Firma Verificacion",
  emision:    "Pendiente Firma Emisor",
}

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
 * - Revisor (Filtro 1): quien transicionó a "En Verificacion Final"
 * - Verificador (Filtro 2): quien transicionó a "En Revision Emisor"
 * - Emisor (Filtro 3): quien transicionó a "Pendiente Firma Dictamen" o "Emitido"
 *
 * UEFA no se resuelve aquí a propósito: el bloque UEFA no queda atado a la
 * persona específica que aprobó ("Pendiente DO"), sino que lo puede firmar
 * cualquier usuario con rol UEFA (ver usuarioIdParaFirmante y la verificación
 * de rol en /api/firma-efirma/firmar-interno). Esto evita que, si quien
 * aprobó usó una cuenta distinta (p. ej. Administrador) a la cuenta UEFA
 * real, el bloque quede huérfano para siempre.
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
  // Última coincidencia, no la primera: si la solicitud fue observada y
  // regresó a este mismo filtro (p. ej. tras "Reasignar Revisor"), puede
  // haber más de una transición a este estado en el historial — la más
  // reciente es quien realmente la aprobó al final, no quien la aprobó la
  // primera vez antes de que la devolvieran.
  const ultimaCoincidencia = (nombres: string[]) => {
    for (let i = historial.length - 1; i >= 0; i--) {
      if (matchNombre(historial[i], nombres)) return historial[i]
    }
    return undefined
  }

  const revisorEntry   = ultimaCoincidencia(["En Verificacion Final"])
  const validadorEntry = ultimaCoincidencia(["En Revision Emisor"])
  const emisorEntry    = ultimaCoincidencia(["Pendiente Firma Dictamen", "Pendiente Firma Justificacion", "Emitido"])

  return {
    revisor_id:   revisorEntry?.usuario_id    ?? null,
    validador_id: validadorEntry?.usuario_id  ?? null,
    emisor_id:    emisorEntry?.usuario_id     ?? null,
  }
}

/**
 * Resuelve el usuario_id para una entrada de plantilla interna, según su bandeja.
 * Devuelve null si es externo, si es UEFA o Validación (quedan libres para
 * cualquier usuario con ese rol — ver la verificación de rol en
 * /api/firma-efirma/firmar-interno), o si no se encontró al interno en el
 * historial.
 */
export function usuarioIdParaFirmante(
  template: FirmanteTemplate,
  creadoPorId: string,
  internos: UsuariosInternosResueltos,
): string | null {
  if (template.tipo !== "interno") return null
  switch (template.bandeja) {
    case "uefa":       return null
    case "revision":   return internos.revisor_id
    case "validacion": return null
    case "emision":    return internos.emisor_id
    default:           return null
  }
}
