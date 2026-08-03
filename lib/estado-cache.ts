import { prisma } from "@/lib/prisma"

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { id: number; expiresAt: number }>()

function cacheKey(nombre: string): string {
  return nombre.trim().toLowerCase()
}

/**
 * Resuelve el id de un `estado` por nombre (case-insensitive), con cache en
 * memoria (TTL corto) para evitar el findFirst repetido en cada request.
 * Si no existe y `crearSiNoExiste` viene con datos, lo crea.
 */
export async function getEstadoId(
  nombre: string,
  opts?: { crearSiNoExiste?: { descripcion?: string } },
): Promise<number | null> {
  const key = cacheKey(nombre)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.id

  const estado = await prisma.estado.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  })
  if (estado) {
    cache.set(key, { id: estado.id, expiresAt: Date.now() + TTL_MS })
    return estado.id
  }

  if (opts?.crearSiNoExiste) {
    const creado = await prisma.estado.create({
      data: { nombre, descripcion: opts.crearSiNoExiste.descripcion ?? `Estado: ${nombre}` },
    })
    cache.set(key, { id: creado.id, expiresAt: Date.now() + TTL_MS })
    return creado.id
  }

  return null
}
