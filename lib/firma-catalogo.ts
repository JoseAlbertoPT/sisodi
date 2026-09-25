import { prisma } from "@/lib/prisma";
import { firmaDatosEx, fechaDocumentoHoy } from "@/lib/firma-oficio-client";
import type { FirmaPortal } from "@/lib/pdf-firma-estampado";

const BYPASS = process.env.EFIRMA_BYPASS === "true";

export interface FirmaCatalogoInput {
  usuarioId: string
  cargo: string
  folio: string
  certificado?: string
  clavePrivada?: string
  fraseClavePrivada?: string
  /** Nombre/RFC extraídos del .cer en el navegador (lib/certificado-cer.ts) —
   *  cuando vienen, se usan en vez del nombre/RFC del usuario en la app, para
   *  que la Constancia refleje a quien realmente posee ese certificado. */
  nombreCert?: string
  rfcCert?: string
  /** Prefijo del rol en la Constancia: "Realizó" (UEFA) o "Vo.Bo." (Emisor). */
  rolFirmante?: string
}

function selloFalso(prefix: string, length = 344): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = prefix;
  while (out.length < length) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out.slice(0, length - 2) + "==";
}

/**
 * Resuelve la firma electrónica de quien reutiliza desde Catálogo — un solo
 * firmante, autofirma inmediata (no pasa por firma_proceso/firma_firmante:
 * a diferencia de una solicitud normal, aquí no hay un solicitud_id propio
 * al que atar un proceso multi-firmante, y no lo necesita — es un sello
 * inmediato de una sola persona, no un flujo de varios pasos). Devuelve la
 * misma forma (FirmaPortal) que usa la Constancia de Firma Electrónica de
 * Dictámenes, para reutilizar exactamente esa página (ver agregarConstanciaFirma).
 */
export async function resolverFirmaCatalogo(input: FirmaCatalogoInput): Promise<FirmaPortal> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: input.usuarioId },
    select: { nombre: true, rfc: true },
  });
  if (!usuario?.rfc) {
    throw new Error("Tu usuario no tiene RFC registrado. Contacta al administrador.");
  }
  if (!input.cargo?.trim()) {
    throw new Error("Falta el cargo/puesto de quien firma.");
  }
  const cargo = input.cargo.trim().toUpperCase();
  const rfcCertTrim = input.rfcCert?.trim() ?? "";
  const nombreCertTrim = input.nombreCert?.trim() ?? "";
  const rfc = (rfcCertTrim || usuario.rfc).toUpperCase();
  const nombre = nombreCertTrim || usuario.nombre;
  const ahora = new Date();

  if (!BYPASS) {
    if (!input.certificado || !input.clavePrivada || !input.fraseClavePrivada) {
      throw new Error("Faltan credenciales de e.firma (.cer, .key y contraseña).");
    }
    // Firma real vía WSFirmaOficio (firmaDatosEx) — un solo sello de una sola
    // vez, sin crear un firma_proceso persistente. No hay aún un PDF final
    // (se renderiza después, en buildResponse) así que el "contenido" a
    // sellar es un texto descriptivo, no el documento — igual que la
    // Constancia calcula su propia huella SHA-256 del PDF final por separado.
    const resultado = await firmaDatosEx({
      certificado: input.certificado,
      clavePrivada: input.clavePrivada,
      fraseClavePrivada: input.fraseClavePrivada,
      folioDocumento: input.folio,
      // DD/MM/YYYY, no ISO (ver fechaDocumentoHoy en lib/firma-oficio-client.ts).
      fechaDocumento: fechaDocumentoHoy(ahora),
      contenido: `Reutilización de Catálogo — Folio ${input.folio} — ${rfc} — ${ahora.toISOString()}`,
      destinatario: { nombreCompleto: nombre ?? rfc, rfc },
    });
    return {
      usuario: rfc,
      rolFirmante: `${input.rolFirmante ?? "Realizó"} — ${cargo}`,
      responsable: nombre,
      selloDigital: resultado.selloDigital,
      estampadoTiempo: resultado.estampadoTiempo ?? ahora.toISOString().replace("T", " ").slice(0, 19),
      selloEstampadoTiempo: resultado.selloEstampadoTiempo,
      noCertificado: null,
      noCertificadoGEM: resultado.noCertificadoGEM,
      rfcGEM: resultado.rfcGEM,
      urlValidacion: resultado.urlValidacion,
      firmadoEn: ahora,
      cargo,
      documento: "DICTAMEN TÉCNICO FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS",
    };
  }

  // Modo bypass (desarrollo): mismos datos ficticios que usa el resto del
  // sistema para simular una firma completa sin llamar al portal real.
  return {
    usuario: rfc,
    rolFirmante: `${input.rolFirmante ?? "Realizó"} — ${cargo}`,
    responsable: nombre,
    selloDigital: selloFalso("DEMO"),
    estampadoTiempo: ahora.toISOString().replace("T", " ").slice(0, 19),
    selloEstampadoTiempo: selloFalso("GEM"),
    noCertificado: "00001000000700000001",
    noCertificadoGEM: "00001000000709040175",
    rfcGEM: "GEM720601TW9",
    urlValidacion: `https://firma-dev.morelos.gob.mx/ValidacionFirma?uuid=${crypto.randomUUID()}`,
    firmadoEn: ahora,
    cargo,
    documento: "DICTAMEN TÉCNICO FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS",
  };
}
