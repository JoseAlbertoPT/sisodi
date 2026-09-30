import { prisma } from "@/lib/prisma"
import { consultarProyectosPorDependencia, type SigefProyecto } from "@/lib/sigef-client"
import { normalizeText } from "@/lib/utils"
import { MANUAL_OVERRIDES } from "@/lib/importar-catalogo-excel"

// Lo que se sube a SIGeF (proyectos nuevos o modificados, unidades movidas de
// Secretaría) debe verse en cuanto el usuario abre el formulario, así que se
// consulta a SIGeF en vivo. El caché solo sirve para dos cosas:
//  - Que varios usuarios abriendo el formulario en el mismo minuto compartan
//    una sola consulta (consultar todas las unidades de una Secretaría son
//    varias llamadas SOAP en paralelo, ~4s para la de 26 unidades).
//  - Tener el último dato bueno para seguir mostrando algo si SIGeF falla.
// `limpiarCacheSigef` fuerza la siguiente consulta a ir a SIGeF.
export const CACHE_TTL_MS = 60 * 1000
const cache = new Map<string, { at: number; proyectos: SigefProyecto[] }>()
const enCurso = new Map<string, Promise<SigefProyecto[]>>()

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

/** Una sola consulta a SIGeF por dependencia a la vez; la comparten quienes lleguen mientras corre. */
function consultarEnVivo(idDependencia: string): Promise<SigefProyecto[]> {
  let p = enCurso.get(idDependencia)
  if (!p) {
    p = consultarProyectosPorDependencia(idDependencia)
      .then((proyectos) => {
        cache.set(idDependencia, { at: Date.now(), proyectos })
        fallos.delete(idDependencia)
        return proyectos
      })
      .catch((e) => {
        const error = e instanceof Error ? e : new Error(String(e))
        fallos.set(idDependencia, { at: Date.now(), error })
        throw error
      })
      .finally(() => enCurso.delete(idDependencia))
    enCurso.set(idDependencia, p)
  }
  return p
}

/** Olvida todo lo cacheado: la siguiente consulta va directo a SIGeF. */
export function limpiarCacheSigef(): void {
  cache.clear()
  fallos.clear()
}

export async function getProyectosCached(idDependencia: string): Promise<SigefProyecto[]> {
  const cached = cache.get(idDependencia)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.proyectos

  // SIGeF acaba de fallar: no se le hace esperar al usuario otro timeout.
  // Se muestra lo último que se obtuvo o, si no hay nada, se cae al fallback.
  const fallo = fallos.get(idDependencia)
  if (fallo && Date.now() - fallo.at < FALLO_TTL_MS) {
    if (cached) return cached.proyectos
    throw fallo.error
  }

  try {
    return await consultarEnVivo(idDependencia)
  } catch (e) {
    if (cached) {
      console.error("[sigef] falló la consulta en vivo, se usa el último dato", idDependencia, e)
      return cached.proyectos
    }
    throw e
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
    select: { nombre: true, sigef_nombre: true, sigef_id_dependencia: true },
  })
  // El nombre con el que SIGeF la conoce también vale (ej. registros que
  // guardaron la Secretaría con el nombre de SIGeF, no el del catálogo).
  const porNombre = new Map<string, number>()
  for (const n of nodos) {
    if (n.sigef_nombre) porNombre.set(normalizeText(n.sigef_nombre), n.sigef_id_dependencia as number)
  }
  for (const n of nodos) porNombre.set(normalizeText(n.nombre), n.sigef_id_dependencia as number)

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
// Solo llena las que aún no tienen dato: las que ya lo tienen se consultan en
// vivo cuando alguien abre el formulario, así que refrescarlas aquí serían
// llamadas SOAP de más.
export async function warmAllKnownDependencias(): Promise<void> {
  try {
    const nodos = await prisma.organo_centralizado.findMany({
      where: { parent_id: null, sigef_id_dependencia: { not: null } },
      select: { sigef_id_dependencia: true },
    })
    const ids = nodos.map((n) => String(n.sigef_id_dependencia)).filter((id) => !cache.has(id))
    if (ids.length === 0) return
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
