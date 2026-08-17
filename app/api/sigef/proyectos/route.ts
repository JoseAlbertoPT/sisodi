import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consultarProyectosPorDependencia, type SigefProyecto } from "@/lib/sigef-client"
import { normalizeText } from "@/lib/utils"
import { MANUAL_OVERRIDES } from "@/lib/importar-catalogo-excel"

export const runtime = "nodejs"

// Los registros históricos/importados no siempre guardan la Secretaría con el
// nombre canónico (mayúsculas sin acentos, o variantes como "GOBERNATURA" en
// vez de "GUBERNATURA" — mismo typo que ya tenía que resolver el importador
// del catálogo). Se normaliza acentos/mayúsculas y se reutiliza el mismo mapa
// de variantes conocidas (MANUAL_OVERRIDES) para no tener dos catálogos de
// alias que se puedan desincronizar.
const overridesNormalizados = new Map(
  Object.entries(MANUAL_OVERRIDES).map(([raw, canonico]) => [normalizeText(raw), canonico]),
)

async function resolverIdDependencia(secretariaRaw: string): Promise<number | null> {
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

// Cachea el resultado por idDependencia: consultar todas las unidades de una
// Secretaría implica varias llamadas SOAP en paralelo (una por unidad) — para
// la dependencia con más unidades observada (26) esto tarda ~4s reales. El
// catálogo de proyectos no cambia con frecuencia, así que se sirve
// stale-while-revalidate: si el caché expiró, se regresa el dato viejo de
// inmediato y se refresca en segundo plano para la siguiente consulta — el
// usuario solo espera los ~4s la primera vez que se pide esa dependencia
// desde que arrancó el servidor, nunca en cargas posteriores.
const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, { at: number; proyectos: SigefProyecto[] }>()
const refrescando = new Set<string>()

function refrescarEnSegundoPlano(idDependencia: string) {
  if (refrescando.has(idDependencia)) return
  refrescando.add(idDependencia)
  consultarProyectosPorDependencia(idDependencia)
    .then((proyectos) => cache.set(idDependencia, { at: Date.now(), proyectos }))
    .catch((e) => console.error("[sigef cache refresh]", idDependencia, e))
    .finally(() => refrescando.delete(idDependencia))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secretaria = searchParams.get("secretaria")?.trim()
  if (!secretaria) {
    return NextResponse.json({ error: "Falta secretaria" }, { status: 400 })
  }

  try {
    const idDependenciaNum = await resolverIdDependencia(secretaria)
    if (idDependenciaNum == null) {
      // Secretaría todavía sin idDependencia de SIGeF configurado (o el texto
      // guardado no se pudo emparejar con ninguna Secretaría conocida): el
      // formulario debe caer de regreso a su comportamiento actual, no es un error.
      return NextResponse.json({ configured: false, proyectos: [] })
    }

    const idDependencia = String(idDependenciaNum)
    const cached = cache.get(idDependencia)
    let proyectos: SigefProyecto[]
    if (cached) {
      proyectos = cached.proyectos
      if (Date.now() - cached.at >= CACHE_TTL_MS) refrescarEnSegundoPlano(idDependencia)
    } else {
      proyectos = await consultarProyectosPorDependencia(idDependencia)
      cache.set(idDependencia, { at: Date.now(), proyectos })
    }

    const opciones = proyectos.map((p) => ({
      value: `${p.proyecto} - ${p.nombreProyecto}`,
      label: `${p.proyecto} - ${p.nombreProyecto}`,
    }))

    return NextResponse.json({ configured: true, proyectos: opciones })
  } catch (e) {
    console.error("[GET /api/sigef/proyectos]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al consultar SIGeF" },
      { status: 502 },
    )
  }
}
