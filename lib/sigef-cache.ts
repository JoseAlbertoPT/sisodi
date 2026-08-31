import { prisma } from "@/lib/prisma"
import { consultarProyectosPorDependencia, type SigefProyecto } from "@/lib/sigef-client"
import { normalizeText } from "@/lib/utils"
import { MANUAL_OVERRIDES } from "@/lib/importar-catalogo-excel"

// Cachea el resultado por idDependencia: consultar todas las unidades de una
// Secretaría implica varias llamadas SOAP en paralelo (una por unidad) — para
// la dependencia con más unidades observada (26) esto tarda ~4s reales. El
// catálogo de proyectos no cambia con frecuencia, así que se sirve
// stale-while-revalidate: si el caché expiró, se regresa el dato viejo de
// inmediato y se refresca en segundo plano para la siguiente consulta — el
// usuario solo espera esos ~4s si nadie los precalentó antes (ver
// `warmAllKnownDependencias`, llamado una vez al arrancar el servidor desde
// instrumentation.ts) o si el TTL ya venció.
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { at: number; proyectos: SigefProyecto[] }>()
const refrescando = new Set<string>()

// El WS de SIGeF corre en la infraestructura del proveedor y se ha visto caer
// de forma intermitente incluso ya en producción (ver project_sigef_ws
// memory / integracion-sigef-progreso.md). Sin esto, mientras el servicio
// está caído CADA usuario que abre el formulario paga el timeout completo
// (SIGEF_TIMEOUT_MS, 10s por default) antes de caer al catálogo local — se
// siente como que "Programa o Proyecto a veces no carga". Cacheamos la falla
// un rato corto para que los siguientes intentos caigan al fallback de
// inmediato en vez de reintentar contra un servicio que ya sabemos que no
// responde.
const FALLO_TTL_MS = 2 * 60 * 1000
const fallos = new Map<string, { at: number; error: Error }>()

function refrescarEnSegundoPlano(idDependencia: string) {
  if (refrescando.has(idDependencia)) return
  refrescando.add(idDependencia)
  consultarProyectosPorDependencia(idDependencia)
    .then((proyectos) => {
      cache.set(idDependencia, { at: Date.now(), proyectos })
      fallos.delete(idDependencia)
    })
    .catch((e) => console.error("[sigef cache refresh]", idDependencia, e))
    .finally(() => refrescando.delete(idDependencia))
}

export async function getProyectosCached(idDependencia: string): Promise<SigefProyecto[]> {
  const cached = cache.get(idDependencia)
  if (cached) {
    if (Date.now() - cached.at >= CACHE_TTL_MS) refrescarEnSegundoPlano(idDependencia)
    return cached.proyectos
  }
  const fallo = fallos.get(idDependencia)
  if (fallo && Date.now() - fallo.at < FALLO_TTL_MS) throw fallo.error

  try {
    const proyectos = await consultarProyectosPorDependencia(idDependencia)
    cache.set(idDependencia, { at: Date.now(), proyectos })
    fallos.delete(idDependencia)
    return proyectos
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    fallos.set(idDependencia, { at: Date.now(), error })
    throw error
  }
}

// Los registros históricos/importados no siempre guardan la Secretaría con el
// nombre canónico (mayúsculas sin acentos, o variantes como "GOBERNATURA" en
// vez de "GUBERNATURA" — mismo typo que ya tenía que resolver el importador
// del catálogo). Se normaliza acentos/mayúsculas y se reutiliza el mismo mapa
// de variantes conocidas (MANUAL_OVERRIDES) para no tener dos catálogos de
// alias que se puedan desincronizar.
const overridesNormalizados = new Map(
  Object.entries(MANUAL_OVERRIDES).map(([raw, canonico]) => [normalizeText(raw), canonico]),
)

export async function resolverIdDependencia(secretariaRaw: string): Promise<number | null> {
  const nodos = await prisma.organo_centralizado.findMany({
    where: { parent_id: null, sigef_id_dependencia: { not: null } },
    select: { nombre: true, sigef_id_dependencia: true },
  })
  const porNombre = new Map(nodos.map((n) => [normalizeText(n.nombre), n.sigef_id_dependencia as number]))

  const normInput = normalizeText(secretariaRaw)
  const directo = porNombre.get(normInput)
  if (directo != null) return directo

  const canonico = overridesNormalizados.get(normInput)
  if (canonico) {
    const viaOverride = porNombre.get(normalizeText(canonico))
    if (viaOverride != null) return viaOverride
  }

  return null
}

// Precalienta el caché de todas las Secretarías con idDependencia de SIGeF
// configurado. Se llama una sola vez al arrancar el servidor (instrumentation.ts)
// para que ningún usuario sea quien pague los ~4s de la primera consulta del
// día — para entonces el servidor ya lleva unos segundos vivo y nadie ha
// abierto el formulario todavía. Va en paralelo y no bloquea el arranque.
export async function warmAllKnownDependencias(): Promise<void> {
  try {
    const nodos = await prisma.organo_centralizado.findMany({
      where: { parent_id: null, sigef_id_dependencia: { not: null } },
      select: { sigef_id_dependencia: true },
    })
    const ids = nodos.map((n) => String(n.sigef_id_dependencia))
    const resultados = await Promise.allSettled(ids.map((id) => getProyectosCached(id)))

    // Una línea con stack trace por dependencia ensucia el arranque sin
    // aportar nada — todas fallan por la misma razón (SIGeF caído o
    // inalcanzable desde esta red). Un resumen basta; el error completo ya
    // quedó cacheado en `fallos` para quien lo necesite al consultar.
    const fallidas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected")
    if (fallidas.length > 0) {
      const motivo = fallidas[0]?.reason instanceof Error ? fallidas[0].reason.message : String(fallidas[0]?.reason)
      console.error(
        `[sigef warmup] ${fallidas.length}/${ids.length} dependencias fallaron al precalentar (ej: ${motivo})`,
      )
    }
  } catch (e) {
    console.error("[sigef warmup] no se pudo precalentar el caché", e)
  }
}
