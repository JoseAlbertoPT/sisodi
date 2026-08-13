import { prisma } from "@/lib/prisma"

/**
 * Devuelve los ids de todos los nodos de `organo_centralizado` que pertenecen a la
 * MISMA Secretaría que el nodo `secretariaId` recibido.
 *
 * `usuario.secretaria_id` apunta a un nodo cualquiera del árbol jerárquico de
 * `organo_centralizado` (Secretaría › Dirección › Subdirección › …). El alcance de
 * visibilidad de las solicitudes es a nivel Secretaría: un usuario de una Dirección
 * debe ver todo lo de su Secretaría, sin importar el área concreta.
 *
 * Para lograrlo se sube desde el nodo del usuario hasta la raíz (la Secretaría, el
 * nodo con `parent_id = null`) y luego se recogen todos sus descendientes. El
 * resultado se usa con `secretaria_id_snapshot: { in: [...] }` en los filtros.
 *
 * Si el nodo no se encuentra o el árbol viene vacío, se hace fallback al id exacto
 * para no ampliar la visibilidad de forma incorrecta.
 */
export async function getSecretariaScopeIds(secretariaId: string): Promise<string[]> {
  const nodos = await prisma.organo_centralizado.findMany({
    select: { id: true, parent_id: true },
  })
  if (nodos.length === 0) return [secretariaId]

  const byId = new Map(nodos.map((n) => [n.id, n]))
  if (!byId.has(secretariaId)) return [secretariaId]

  // 1) Subir hasta la raíz (Secretaría).
  let raizId = secretariaId
  const subiendo = new Set<string>()
  while (true) {
    const nodo = byId.get(raizId)
    if (!nodo || nodo.parent_id == null) break
    if (subiendo.has(raizId)) break // guardia anti-ciclo
    subiendo.add(raizId)
    raizId = nodo.parent_id
  }

  // 2) Bajar recogiendo todos los descendientes de la raíz.
  const hijosDe = new Map<string, string[]>()
  for (const n of nodos) {
    if (n.parent_id) {
      const arr = hijosDe.get(n.parent_id) ?? []
      arr.push(n.id)
      hijosDe.set(n.parent_id, arr)
    }
  }

  const scope: string[] = []
  const visto = new Set<string>()
  const stack = [raizId]
  while (stack.length) {
    const cur = stack.pop()!
    if (visto.has(cur)) continue
    visto.add(cur)
    scope.push(cur)
    for (const h of hijosDe.get(cur) ?? []) stack.push(h)
  }

  return scope
}
