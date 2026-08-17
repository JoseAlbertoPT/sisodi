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
 * vienen escapadas (JSON inválido según el estándar). Se manejan 3 casos por
 * separado, cada uno con su propio error — no deben compartir un catch, para
 * no perder el mensaje real de un error de negocio (error != 0) ni confundirlo
 * con un problema de formato:
 *
 *  A) El JSON exterior no es válido (típicamente por las comillas internas sin
 *     escapar) → se recorta el arreglo de proyectos directamente con regex.
 *  B) El JSON exterior es válido pero SIGeF reportó error != 0 → se propaga el
 *     código y el mensaje de negocio tal cual los mandó el servicio.
 *  C) El JSON exterior es válido y error === 0, pero "message" no es un JSON
 *     de proyectos parseable → error de formato distinto a los otros dos.
 */
function parseProyectosReturn(raw: string): SigefProyecto[] {
  const trimmed = raw.trim()

  let entry: { error?: unknown; message?: unknown } | undefined
  try {
    const outer = JSON.parse(trimmed)
    entry = Array.isArray(outer) ? outer[0] : outer
  } catch {
    entry = undefined
  }

  if (entry === undefined) {
    // Caso A: JSON exterior mal formado (comillas internas sin escapar).
    const match = trimmed.match(/"message"\s*:\s*"(\[[\s\S]*\])"\s*\}/)
    if (!match) throw new Error("Respuesta de SIGeF con formato inesperado (JSON exterior inválido)")
    try {
      return JSON.parse(match[1]) as SigefProyecto[]
    } catch (e) {
      throw new Error(`No se pudo parsear el arreglo de proyectos extraído por regex: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!("error" in entry)) {
    throw new Error("Respuesta de SIGeF con formato inesperado (falta el campo 'error')")
  }
  if (Number(entry.error) !== 0) {
    // Caso B: error de negocio explícito de SIGeF — se propaga tal cual.
    throw new Error(`SIGeF respondió error=${entry.error}: ${entry.message ?? ""}`)
  }

  // Caso C: error === 0 pero "message" no es un JSON de proyectos válido.
  try {
    return JSON.parse(String(entry.message ?? "")) as SigefProyecto[]
  } catch (e) {
    throw new Error(`SIGeF respondió error=0 pero "message" no es JSON válido: ${e instanceof Error ? e.message : e}`)
  }
}

function extraerProyectosReturn(xml: string): string {
  const match = xml.match(/<(?:\w+:)?proyectosReturn>([\s\S]*?)<\/(?:\w+:)?proyectosReturn>/)
  if (!match) throw new Error("No se encontró proyectosReturn en la respuesta de SIGeF")
  return match[1]
}

function getTimeoutMs(): number {
  const raw = Number(process.env.SIGEF_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 10_000
}

export async function consultarProyectosSigef(idUnidad: number): Promise<SigefProyecto[]> {
  const timeoutMs = getTimeoutMs()
  let res: Response
  try {
    res = await fetch(getWsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: buildEnvelope(idUnidad),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`SIGeF no respondió en ${timeoutMs}ms (timeout)`)
    }
    throw new Error(`No se pudo conectar con SIGeF: ${e instanceof Error ? e.message : e}`)
  }
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`SIGeF respondió HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const proyectosReturn = extraerProyectosReturn(text)
  return parseProyectosReturn(proyectosReturn)
}
