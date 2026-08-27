// Cliente del Web Service SOAP de SIGeF (ControlProyectosServicio). Expone 3
// operaciones, todas con el mismo patrón request/response (un string JSON de
// entrada, un string JSON anidado de salida):
//  - proyectos({appId, idUnidad})      -> proyectos/programas aprobados de esa unidad
//  - dependencias({appId})             -> catálogo completo de Secretarías/Dependencias
//  - unidades({appId, idDependencia})  -> unidades dentro de una Dependencia (trae el idUnidad)
//
// El endpoint todavía vive en un ambiente de pruebas del proveedor (por moverse
// a QA, y observado como intermitente — corre desde la máquina del proveedor,
// no un servidor desplegado); por eso la URL y el appId salen de variables de
// entorno y no se hardcodean como definitivos.

const DEFAULT_WS_URL = "http://192.168.114.116:8080/wsproyectos/services/ControlProyectosServicio"

function getWsUrl(): string {
  return process.env.SIGEF_WS_URL ?? DEFAULT_WS_URL
}

function getAppId(): string {
  const appId = process.env.SIGEF_APP_ID
  if (!appId) throw new Error("SIGEF_APP_ID no configurado en el entorno")
  return appId
}

function getTimeoutMs(): number {
  const raw = Number(process.env.SIGEF_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 10_000
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

export interface SigefDependencia {
  idDependencia: string
  codigoDependencia: string
  dependencia: string
}

export interface SigefUnidad {
  idUnidad: string
  codigoUnidad: string
  unidad: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * El servicio real (Apache Axis 1.x) devuelve el contenido de "*Return" con
 * las comillas del JSON anidado codificadas como entidades XML (&quot;), no
 * como comillas crudas — confirmado contra el ambiente real el 2026-08-17.
 * Hay que decodificarlas antes de intentar parsear JSON. &amp; va al final
 * para no des-escapar de más (p.ej. "&amp;quot;" no debe volverse "&quot;"... quot;).
 */
function unescapeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function buildEnvelope(operation: string, extraFields: Record<string, unknown>): string {
  const requestJson = JSON.stringify([{ appId: getAppId(), ...extraFields }])
  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:impl="http://impl.servicios.ws.wsproyectos.morelos.gob.mx">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<impl:${operation}><impl:request>${escapeXml(requestJson)}</impl:request></impl:${operation}>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  )
}

function extraerReturn(xml: string, operation: string): string {
  const tag = `${operation}Return`
  const re = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`)
  const match = xml.match(re)
  if (!match) throw new Error(`No se encontró ${tag} en la respuesta de SIGeF`)
  return unescapeXmlEntities(match[1])
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
function parseSigefReturn<T>(raw: string): T[] {
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
      return JSON.parse(match[1]) as T[]
    } catch (e) {
      throw new Error(`No se pudo parsear el arreglo extraído por regex: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!("error" in entry)) {
    throw new Error("Respuesta de SIGeF con formato inesperado (falta el campo 'error')")
  }
  if (Number(entry.error) !== 0) {
    // Caso B: error de negocio explícito de SIGeF — se propaga tal cual.
    throw new Error(`SIGeF respondió error=${entry.error}: ${entry.message ?? ""}`)
  }

  // Caso C: error === 0 pero "message" no es un JSON válido.
  try {
    return JSON.parse(String(entry.message ?? "")) as T[]
  } catch (e) {
    throw new Error(`SIGeF respondió error=0 pero "message" no es JSON válido: ${e instanceof Error ? e.message : e}`)
  }
}

async function callSigefOperation<T>(operation: string, extraFields: Record<string, unknown>): Promise<T[]> {
  const timeoutMs = getTimeoutMs()
  let res: Response
  try {
    res = await fetch(getWsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: buildEnvelope(operation, extraFields),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`SIGeF no respondió en ${timeoutMs}ms (timeout)`)
    }
    // `fetch failed` es el mensaje genérico de undici; la razón real (conexión
    // rechazada, DNS, TLS, socket cerrado a medias) vive en `e.cause` y sin
    // esto se pierde — dejando "fetch failed" como único rastro en los logs,
    // sin forma de saber qué fue distinto entre un intento que sí conecta y
    // uno que no.
    const causa = e instanceof Error && e.cause ? ` (causa: ${String((e.cause as any)?.code ?? e.cause)})` : ""
    throw new Error(`No se pudo conectar con SIGeF: ${e instanceof Error ? e.message : e}${causa}`)
  }
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`SIGeF respondió HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const raw = extraerReturn(text, operation)
  return parseSigefReturn<T>(raw)
}

export async function consultarProyectosSigef(idUnidad: number): Promise<SigefProyecto[]> {
  return callSigefOperation<SigefProyecto>("proyectos", { idUnidad })
}

export async function consultarDependenciasSigef(): Promise<SigefDependencia[]> {
  return callSigefOperation<SigefDependencia>("dependencias", {})
}

export async function consultarUnidadesSigef(idDependencia: string): Promise<SigefUnidad[]> {
  return callSigefOperation<SigefUnidad>("unidades", { idDependencia })
}

/**
 * "proyectos" solo acepta un idUnidad, y cada unidad dentro de una Dependencia
 * trae proyectos distintos (confirmado 2026-08-17: Oficina de la Persona
 * Titular de la Secretaría de Gobierno y Subsecretaría de Gobierno, misma
 * Dependencia, cero proyectos en común). Por eso "Programa o Proyecto" para
 * una Secretaría completa se arma consultando TODAS sus unidades y uniendo
 * los resultados, deduplicados por clave de proyecto.
 */
export async function consultarProyectosPorDependencia(idDependencia: string): Promise<SigefProyecto[]> {
  const unidades = await consultarUnidadesSigef(idDependencia)
  const resultados = await Promise.allSettled(
    unidades.map((u) => consultarProyectosSigef(Number(u.idUnidad))),
  )

  const fallidas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected")
  if (unidades.length > 0 && fallidas.length === resultados.length) {
    // Todas las unidades fallaron: es una falla real, no "esta dependencia no tiene proyectos".
    const primerError = fallidas[0]?.reason
    throw new Error(
      `No se pudo consultar ninguna unidad de la dependencia ${idDependencia}: ${primerError instanceof Error ? primerError.message : primerError}`,
    )
  }

  const vistos = new Set<string>()
  const proyectos: SigefProyecto[] = []
  for (const r of resultados) {
    if (r.status !== "fulfilled") continue
    for (const p of r.value) {
      if (vistos.has(p.proyecto)) continue
      vistos.add(p.proyecto)
      proyectos.push(p)
    }
  }
  return proyectos
}
