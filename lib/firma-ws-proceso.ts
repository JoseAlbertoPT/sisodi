import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { firmaDatosEx, fechaDocumentoHoy, FirmaOficioError, type FirmaDatosExResultado } from "@/lib/firma-oficio-client"
import { s3Download } from "@/lib/s3"

const FIRMA_S3_PREFIX = "firma-efirma"

// Los DatosFirma que WSFirmaOficio ata al documento multifirma en la primera
// firma. Se guardan en firma_proceso.datos_ws_firma y se reenvían idénticos en
// cada firma siguiente — igual que efirma-portal1 (api/multifirma/firmar),
// que guarda folio/fecha/contenido/destinatario en el proceso al iniciarlo.
// Si cualquiera cambia (la fecha al firmar otro día, el destinatario al firmar
// otra persona, el contenido si llevaba RFC o timestamp) el servicio responde
// codigoRespuesta 1029 ("Los datos del documento a firmar no coinciden").
interface DatosWsFirma {
  folioDocumento: string
  fechaDocumento: string
  contenido: string
  destinatario: { nombreCompleto: string; rfc?: string }
}

// El uuid del PDF en S3 (nuestra key interna) es distinto del uuid del
// "documento multifirma" que WSFirmaOficio genera y regresa en la primera
// firma real — hay que reenviar ESE (guardado en firma_proceso.uuid_ws_firma)
// en las firmas siguientes, o el servicio responde codigoRespuesta 1027
// ("El documento no existe o no pertenece a multifirma"). En la primera firma
// del proceso uuidWsFirma todavía es null: se manda sin uuid y el servicio
// asigna uno, que se guarda junto con los DatosFirma usados.
export async function firmarProcesoConWsFirmaOficio(opts: {
  proceso: { id: number; uuid: string | null; uuid_ws_firma: string | null; datos_ws_firma: unknown }
  folio: string
  usuarioRfc: string
  nombreFirmante: string
  certificado: string
  clavePrivada: string
  fraseClavePrivada: string
}): Promise<FirmaDatosExResultado> {
  const { proceso } = opts
  let datos = proceso.datos_ws_firma as DatosWsFirma | null

  if (proceso.uuid_ws_firma && !datos) {
    // Procesos cuya primera firma se hizo antes de guardar los DatosFirma: el
    // contenido de entonces llevaba el RFC y un timestamp en vivo, así que no
    // hay forma de reconstruirlo y el servicio rechazará toda firma siguiente.
    throw new Error(
      "Este proceso de firma se inició con una versión anterior del sistema y ya no puede continuarse. Es necesario reiniciar el proceso de firma del documento.",
    )
  }

  if (!datos) {
    // "contenido" se manda como texto corto (folio + huella SHA-256 del PDF),
    // no el PDF completo en base64 — mandar el documento entero (~cientos de KB
    // dentro de un solo campo XML) hacía tronar el servicio con codigoRespuesta
    // 5000 ("Ocurrió un incidente"), un Axis/JAX-WS viejo probablemente sin
    // límite de tamaño de mensaje bien manejado. La huella sigue ligando la
    // firma al documento exacto sin mandar el archivo.
    const pdfBuffer = await s3Download(`${FIRMA_S3_PREFIX}/${proceso.uuid}.pdf`)
    const huella = createHash("sha256").update(pdfBuffer).digest("hex")
    // A pesar de que el XSD marca fechaDocumento y destinatario como
    // opcionales (minOccurs="0"), el servicio responde codigoRespuesta 1000
    // ("Todos los parámetros son requeridos, excepto CURP y RFC") si se
    // omiten — solo CURP y RFC dentro de destinatario son realmente opcionales.
    datos = {
      folioDocumento: opts.folio,
      fechaDocumento: fechaDocumentoHoy(),
      contenido: `Folio ${opts.folio} — SHA-256 ${huella}`,
      destinatario: { nombreCompleto: opts.nombreFirmante, rfc: opts.usuarioRfc },
    }
  }

  const credenciales = {
    certificado: opts.certificado,
    clavePrivada: opts.clavePrivada,
    fraseClavePrivada: opts.fraseClavePrivada,
  }
  let sello: FirmaDatosExResultado
  try {
    sello = await firmaDatosEx({ ...credenciales, ...datos, uuid: proceso.uuid_ws_firma ?? undefined })
  } catch (e) {
    // WSFirmaOficio no deja que una misma e.firma firme dos veces el mismo
    // documento multifirma ("El documento ya fue firmado por el usuario"),
    // pero en este flujo una misma persona sí puede ocupar dos bloques (p. ej.
    // un Administrador que firma UEFA y Validación). En ese caso la firma se
    // manda como documento independiente (sin uuid): el servicio emite un
    // sello propio y real para este bloque, y el multifirma del proceso queda
    // intacto para los demás firmantes.
    const yaFirmo = e instanceof FirmaOficioError && /ya fue firmado por el usuario/i.test(e.mensajeServicio ?? "")
    if (!yaFirmo || !proceso.uuid_ws_firma) throw e
    console.warn(`[firma-ws-proceso] La e.firma ya firmó el multifirma ${proceso.uuid_ws_firma} (código ${e.codigoRespuesta}); se firma este bloque como documento independiente.`)
    return firmaDatosEx({ ...credenciales, ...datos })
  }

  if (!proceso.uuid_ws_firma && sello.uuid) {
    await prisma.firma_proceso.update({
      where: { id: proceso.id },
      data: { uuid_ws_firma: sello.uuid, datos_ws_firma: datos as object },
    })
  }
  return sello
}
