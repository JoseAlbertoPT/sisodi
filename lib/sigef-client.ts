// Cliente del Web Service SOAP de SIGeF (ControlProyectosServicio, operación
// "proyectos"). El servicio recibe un idUnidad y regresa los proyectos/programas
// aprobados de esa unidad — usado para poblar "Programa o Proyecto" en Nueva
// Solicitud sin captura manual.
//
// El endpoint todavía vive en un ambiente de pruebas del proveedor (por moverse
// a QA); por eso la URL y el appId salen de variables de entorno y no se
// hardcodean como definitivos.

const DEFAULT_WS_URL = "http://192.168.114.116:8080/wsproyectos/services/ControlProyectosServicio"

function getWsUrl(): string {
  return process.env.SIGEF_WS_URL ?? DEFAULT_WS_URL
}

function getAppId(): string {
  const appId = process.env.SIGEF_APP_ID
  if (!appId) throw new Error("SIGEF_APP_ID no configurado en el entorno")
  return appId
}

export interface SigefProyecto {
  proyecto: string
  nombreProyecto: string
  codigoDependencia: string
  codigoUnidad: string
  dependencia: string
  unidad: string
  idUnidad: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function buildEnvelope(idUnidad: number): string {
  const requestJson = JSON.stringify([{ appId: getAppId(), idUnidad }])
  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:impl="http://impl.servicios.ws.wsproyectos.morelos.gob.mx">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<impl:proyectos><impl:request>${escapeXml(requestJson)}</impl:request></impl:proyectos>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  )
}

/**
 * El campo "message" de la respuesta trae un JSON anidado como string. En las
 * pruebas contra el servicio de origen, esas comillas internas no siempre
 * vienen escapadas (JSON inválido según el estándar), así que primero se
 * intenta el parseo estricto y, si falla, se recorta el arreglo directamente
 * con una expresión regular.
 */
function parseProyectosReturn(raw: string): SigefProyecto[] {
  const trimmed = raw.trim()
  try {
    const outer = JSON.parse(trimmed)
    const entry = Array.isArray(outer) ? outer[0] : outer
    if (!entry) throw new Error("Respuesta de SIGeF vacía")
    if (Number(entry.error) !== 0) {
      throw new Error(`SIGeF respondió error=${entry.error}: ${entry.message ?? ""}`)
    }
    return JSON.parse(entry.message) as SigefProyecto[]
  } catch {
    const match = trimmed.match(/"message"\s*:\s*"(\[[\s\S]*\])"\s*\}/)
    if (!match) throw new Error("Respuesta de SIGeF con formato inesperado")
    return JSON.parse(match[1]) as SigefProyecto[]
  }
}

function extraerProyectosReturn(xml: string): string {
  const match = xml.match(/<(?:\w+:)?proyectosReturn>([\s\S]*?)<\/(?:\w+:)?proyectosReturn>/)
  if (!match) throw new Error("No se encontró proyectosReturn en la respuesta de SIGeF")
  return match[1]
}

export async function consultarProyectosSigef(idUnidad: number): Promise<SigefProyecto[]> {
  const res = await fetch(getWsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: buildEnvelope(idUnidad),
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`SIGeF respondió HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const proyectosReturn = extraerProyectosReturn(text)
  return parseProyectosReturn(proyectosReturn)
}
