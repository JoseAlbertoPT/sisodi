// Cliente SOAP del servicio de firma electrónica WSFirmaOficio
// (firma-dev.morelos.gob.mx), operación firmaDatosEx — documentación:
// https://tecnologia.morelos.gob.mx/d/6f552849/untitled-document
//
// A diferencia del portal REST que asumía lib/efirma-client.ts (nunca llegó a
// desplegarse: /api/multifirma/* da 404 en firma-dev.morelos.gob.mx), este
// servicio SOAP no maneja "procesos" multi-firmante — cada llamada firma un
// solo firmante de una vez y regresa su sello. El seguimiento de quién ya
// firmó y quién falta lo lleva sisodij-client con sus propias tablas
// firma_proceso/firma_firmante (ver app/api/firma-efirma/*).
//
// Contrato confirmado contra el WSDL/XSD reales del servicio (2026-09-18):
//   firmaDatosEx(token, certificado, clavePrivada, fraseClavePrivada, DatosFirma)
//   DatosFirma: { tipoDocumento, folioDocumento, fechaDocumento?, contenido, destinatario?, uuid? }
//   -> entidadRespuestaFirma: { codigoRespuesta, selloDigital, estampadoTiempo,
//        selloEstampadoTiempo, noCertificadoGEM, rfcGEM, urlValidacion,
//        urlValidacionCorta, uuid, nanoid, mensaje }

const DEFAULT_WS_URL = "https://firma-dev.morelos.gob.mx/WSFirmaOficio"
const DEFAULT_TIPO_DOCUMENTO = 32

function getWsUrl(): string {
  return process.env.FIRMA_OFICIO_WS_URL ?? DEFAULT_WS_URL
}

function getToken(): string {
  const token = process.env.FIRMA_OFICIO_TOKEN
  if (!token) throw new Error("FIRMA_OFICIO_TOKEN no configurado en el entorno")
  return token
}

function getTipoDocumento(): number {
  const raw = Number(process.env.FIRMA_OFICIO_TIPO_DOCUMENTO)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIPO_DOCUMENTO
}

function getTimeoutMs(): number {
  const raw = Number(process.env.FIRMA_OFICIO_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 20_000
}

export interface FirmaDatosExInput {
  certificado: string // .cer en base64
  clavePrivada: string // .key en base64
  fraseClavePrivada: string
  folioDocumento: string
  fechaDocumento?: string
  contenido: string // dato a sellar — base64 del PDF cuando se tiene, o un texto descriptivo
  destinatario?: { nombreCompleto: string; rfc?: string; curp?: string }
  uuid?: string
  tipoDocumento?: number
}

export interface FirmaDatosExResultado {
  codigoRespuesta: number
  mensaje: string | null
  selloDigital: string | null
  estampadoTiempo: string | null
  selloEstampadoTiempo: string | null
  noCertificadoGEM: string | null
  rfcGEM: string | null
  urlValidacion: string | null
  urlValidacionCorta: string | null
  uuid: string | null
  nanoid: string | null
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function xmlTag(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return ""
  return `<${name}>${escapeXml(String(value))}</${name}>`
}

function buildEnvelope(input: FirmaDatosExInput): string {
  const destinatarioXml = input.destinatario?.nombreCompleto
    ? `<destinatario>${xmlTag("nombreCompleto", input.destinatario.nombreCompleto)}${xmlTag("rfc", input.destinatario.rfc)}${xmlTag("curp", input.destinatario.curp)}</destinatario>`
    : ""

  // Orden de campos igual al de la secuencia declarada en el XSD — algunos
  // parsers JAX-WS son estrictos con el orden en document/literal.
  const datosFirmaXml =
    `<DatosFirma>` +
    xmlTag("tipoDocumento", input.tipoDocumento ?? getTipoDocumento()) +
    xmlTag("folioDocumento", input.folioDocumento) +
    xmlTag("fechaDocumento", input.fechaDocumento) +
    xmlTag("contenido", input.contenido) +
    destinatarioXml +
    xmlTag("uuid", input.uuid) +
    `</DatosFirma>`

  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://servicioweb/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<ws:firmaDatosEx>` +
    xmlTag("token", getToken()) +
    xmlTag("certificado", input.certificado) +
    xmlTag("clavePrivada", input.clavePrivada) +
    xmlTag("fraseClavePrivada", input.fraseClavePrivada) +
    datosFirmaXml +
    `</ws:firmaDatosEx>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  )
}

function extraerCampo(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`)
  const match = xml.match(re)
  return match ? match[1] : null
}

function parseRespuesta(xml: string): FirmaDatosExResultado {
  const returnBlock = extraerCampo(xml, "return")
  if (returnBlock === null) {
    const fault = extraerCampo(xml, "faultstring")
    throw new Error(fault ? `WSFirmaOficio SOAP Fault: ${fault}` : "No se encontró <return> en la respuesta de WSFirmaOficio")
  }
  const codigoRespuestaRaw = extraerCampo(returnBlock, "codigoRespuesta")
  return {
    codigoRespuesta: codigoRespuestaRaw !== null ? Number(codigoRespuestaRaw) : NaN,
    mensaje: extraerCampo(returnBlock, "mensaje"),
    selloDigital: extraerCampo(returnBlock, "selloDigital"),
    estampadoTiempo: extraerCampo(returnBlock, "estampadoTiempo"),
    selloEstampadoTiempo: extraerCampo(returnBlock, "selloEstampadoTiempo"),
    noCertificadoGEM: extraerCampo(returnBlock, "noCertificadoGEM"),
    rfcGEM: extraerCampo(returnBlock, "rfcGEM"),
    urlValidacion: extraerCampo(returnBlock, "urlValidacion"),
    urlValidacionCorta: extraerCampo(returnBlock, "urlValidacionCorta"),
    uuid: extraerCampo(returnBlock, "uuid"),
    nanoid: extraerCampo(returnBlock, "nanoid"),
  }
}

// Nunca mandar certificado/clavePrivada/fraseClavePrivada a consola —son
// material de la firma electrónica del firmante. Solo se registra el resto
// del sobre (DatosFirma, token) para depurar sin exponer credenciales.
function envelopeRedactado(input: FirmaDatosExInput): string {
  return buildEnvelope({ ...input, certificado: "[REDACTED]", clavePrivada: "[REDACTED]", fraseClavePrivada: "[REDACTED]" })
}

export async function firmaDatosEx(input: FirmaDatosExInput): Promise<FirmaDatosExResultado> {
  const timeoutMs = getTimeoutMs()
  let res: Response
  try {
    res = await fetch(getWsUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
      body: buildEnvelope(input),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`WSFirmaOficio no respondió en ${timeoutMs}ms (timeout)`)
    }
    const causa = e instanceof Error && e.cause ? ` (causa: ${String((e.cause as any)?.code ?? e.cause)})` : ""
    throw new Error(`No se pudo conectar con WSFirmaOficio: ${e instanceof Error ? e.message : e}${causa}`)
  }
  const text = await res.text()
  if (!res.ok) {
    console.error("[firma-oficio-client] HTTP no-ok. Request:", envelopeRedactado(input), "\nResponse:", text)
    throw new Error(`WSFirmaOficio respondió HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  const resultado = parseRespuesta(text)
  if (resultado.codigoRespuesta !== 0) {
    console.error("[firma-oficio-client] codigoRespuesta != 0. Request:", envelopeRedactado(input), "\nRaw response:", text)
    throw new Error(`WSFirmaOficio respondió código ${resultado.codigoRespuesta}: ${resultado.mensaje ?? "sin mensaje"}`)
  }
  return resultado
}
