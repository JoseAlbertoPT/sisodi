const DEFAULT_BASE_URL = "http://localhost:3001"

function isBypass(): boolean {
  return process.env.EFIRMA_BYPASS === "true"
}

function getBaseUrl() {
  return process.env.EFIRMA_PORTAL_URL ?? DEFAULT_BASE_URL
}

function getProjectToken() {
  const token = process.env.EFIRMA_PROJECT_TOKEN
  if (!token) throw new Error("EFIRMA_PROJECT_TOKEN no configurado en el entorno")
  return token
}

type IniciarPayload = {
  firmarAhora?: boolean
  usuario?: string
  certificado?: string
  clavePrivada?: string
  fraseClavePrivada?: string
  nombre: string
  archivo?: string
  totalFirmantes: number
  destinatario?: { nombreCompleto: string; rfc?: string; curp?: string }
}

type FirmarPayload = {
  procesoId: string
  usuario: string
  certificado: string
  clavePrivada: string
  fraseClavePrivada: string
}

async function callEfirma<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getBaseUrl().replace(/\/$/, "")
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Project-Token": getProjectToken(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data) ? data.error : `efirma-portal ${res.status}`
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg))
  }
  return data as T
}

/** Normaliza la respuesta de firmantesCompletados: puede venir como array de RFCs o número. */
export function firmadosCount(portalRes: any): number {
  const v = portalRes?.firmantesCompletados
  if (Array.isArray(v)) return v.length
  if (typeof v === "number") return v
  if (Array.isArray(portalRes?.firmas)) return portalRes.firmas.length
  return 0
}

/** Normaliza el estado del portal a valores cortos ('iniciado' | 'en_progreso' | 'completado'). */
export function normalizarEstado(portalRes: any, fallback = "iniciado"): string {
  const s = portalRes?.status ?? portalRes?.estado ?? fallback
  return typeof s === "string" ? s : fallback
}

export const efirmaClient = {
  iniciar: (payload: IniciarPayload) => {
    if (isBypass()) {
      const id = `bypass-${Date.now()}`
      return Promise.resolve({ procesoId: id, storageKey: id })
    }
    return callEfirma<any>("/api/multifirma/iniciar", {
      method: "POST",
      body: JSON.stringify({ ...payload, projectToken: getProjectToken() }),
    })
  },
  firmar: (payload: FirmarPayload) => {
    if (isBypass()) return Promise.resolve({ ok: true, firmado: true })
    return callEfirma<any>("/api/multifirma/firmar", {
      method: "POST",
      body: JSON.stringify({ ...payload, projectToken: getProjectToken() }),
    })
  },
  estado: (procesoId: string) => {
    if (isBypass()) return Promise.resolve({ status: "completado", firmantesCompletados: 0 })
    return callEfirma<any>(`/api/multifirma/${encodeURIComponent(procesoId)}/estado`, {
      method: "GET",
    })
  },
}
