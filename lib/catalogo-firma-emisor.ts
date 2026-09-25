import { prisma } from "@/lib/prisma"
import { catalogoDictamenPdfKey, dentroDeAlcance, type AlcanceSolicitudesCatalogo } from "@/lib/catalogo-solicitud-acceso"
import { resolverFirmaCatalogo } from "@/lib/firma-catalogo"
import type { FirmaPortal } from "@/lib/pdf-firma-estampado"
import { buildDictamenCompletoBuffer, type PdfOverrides } from "@/app/api/pdf/dictamen-prestacion-completo/route"
import { s3Upload } from "@/lib/s3"
import { mensajePublico } from "@/lib/error-publico"

export interface CredencialesFirmaEmisor {
  cargo: string
  certificado?: string
  clavePrivada?: string
  fraseClavePrivada?: string
  nombreCert?: string
  rfcCert?: string
}

export type ResultadoFirmaEmisor = { ok: true } | { ok: false; status: number; error: string }

/**
 * Segunda firma (Vo.Bo. del Emisor) de una reutilización de Catálogo ya
 * firmada por UEFA. Única acción posible sobre una solicitud pendiente: no hay
 * observar ni rechazar. Al firmar se genera — por primera vez — el Dictamen
 * final con las dos firmas en la Constancia y la del Emisor impresa en el
 * Dictamen; se guarda en S3 y la solicitud pasa a "firmado". Si algo falla, la
 * solicitud regresa a "pendiente_firma".
 *
 * El llamador ya validó sesión y que `alcance.verTodas` (Emisor/Administrador).
 */
export async function firmarSolicitudCatalogoEmisor(
  id: number,
  usuarioId: string,
  alcance: AlcanceSolicitudesCatalogo,
  cred: CredencialesFirmaEmisor,
): Promise<ResultadoFirmaEmisor> {
  const catSol = await prisma.catalogo_solicitud.findUnique({
    where: { id },
    include: {
      catalogo_justificacion: {
        select: {
          id: true, solicitud_id: true, folio_dictamen: true, secretaria: true, tipo_administracion: true,
          solicitud: { select: { secretaria: true } },
        },
      },
    },
  })
  if (!catSol || !dentroDeAlcance(alcance, catSol.catalogo_justificacion)) {
    return { ok: false, status: 404, error: "Solicitud no encontrada" }
  }
  if (catSol.estado !== "pendiente_firma" || !catSol.firma_uefa) {
    return { ok: false, status: 409, error: "La solicitud ya no está pendiente de firma." }
  }

  // Se aparta la solicitud antes de firmar para que dos Emisores no la firmen a la vez.
  const apartada = await prisma.catalogo_solicitud.updateMany({
    where: { id, estado: "pendiente_firma" },
    data:  { estado: "firmando" },
  })
  if (apartada.count === 0) {
    return { ok: false, status: 409, error: "La solicitud ya no está pendiente de firma." }
  }
  const liberar = () => prisma.catalogo_solicitud.update({ where: { id }, data: { estado: "pendiente_firma" } })

  const cj = catSol.catalogo_justificacion
  let firmaEmisor: FirmaPortal
  try {
    firmaEmisor = await resolverFirmaCatalogo({
      usuarioId,
      cargo: cred.cargo,
      folio: cj.folio_dictamen ?? String(cj.solicitud_id ?? cj.id),
      certificado: cred.certificado,
      clavePrivada: cred.clavePrivada,
      fraseClavePrivada: cred.fraseClavePrivada,
      nombreCert: cred.nombreCert,
      rfcCert: cred.rfcCert,
      rolFirmante: "Vo.Bo.",
    })
  } catch (e) {
    await liberar()
    return { ok: false, status: 400, error: mensajePublico(e, "No se pudo firmar la solicitud") }
  }

  try {
    const [vigenciaInicio, vigenciaFin] = catSol.nueva_vigencia.split("/").map((s) => s.trim())
    const overrides: PdfOverrides = { vigenciaInicio, vigenciaFin }
    const np = catSol.nuevos_numero_prestadores ?? catSol.nuevo_numero_personas
    if (np) overrides.numeroPrestadores = np
    if (catSol.nuevo_programa_proyecto) overrides.programaProyecto = catSol.nuevo_programa_proyecto
    if (catSol.nuevo_importe_bruto != null) overrides.importeBruto = Number(catSol.nuevo_importe_bruto)

    const pdf = await buildDictamenCompletoBuffer(
      cj.solicitud_id ? String(cj.solicitud_id) : null,
      overrides,
      cj.solicitud_id ? null : String(cj.id),
      [catSol.firma_uefa as unknown as FirmaPortal, firmaEmisor],
    )
    if (!pdf.ok) {
      await liberar()
      return { ok: false, status: pdf.status, error: pdf.error }
    }

    const key = catalogoDictamenPdfKey(id)
    await s3Upload(key, Buffer.from(pdf.bytes), "application/pdf")

    await prisma.catalogo_solicitud.update({
      where: { id },
      data: {
        estado:               "firmado",
        firma_emisor:         JSON.parse(JSON.stringify(firmaEmisor)),
        emisor_id:            usuarioId,
        firmado_en:           new Date(),
        archivo_pdf_generado: key,
      },
    })
    return { ok: true }
  } catch (e) {
    console.error("[firmarSolicitudCatalogoEmisor]", id, e)
    await liberar().catch(() => {})
    return { ok: false, status: 500, error: mensajePublico(e, "No se pudo generar el Dictamen") }
  }
}

/** Credenciales del body JSON (mismos nombres de campo en firma individual y por lote). */
export function credencialesDelBody(body: Record<string, unknown>): CredencialesFirmaEmisor {
  const str = (v: unknown) => (v ? String(v) : undefined)
  return {
    cargo: String(body.firma_cargo ?? ""),
    certificado: str(body.firma_certificado),
    clavePrivada: str(body.firma_clave_privada),
    fraseClavePrivada: str(body.firma_frase_clave_privada),
    nombreCert: str(body.nombre_cert),
    rfcCert: str(body.rfc_cert),
  }
}
