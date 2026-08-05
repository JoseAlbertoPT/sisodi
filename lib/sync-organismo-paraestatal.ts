import type { Prisma } from "@/lib/generated/prisma"

type Db = Prisma.TransactionClient

export async function ensureOrganismoParaestatal(db: Db, nombre: string): Promise<void> {
  const nombreTrim = nombre.trim()
  if (!nombreTrim) return
  const existing = await db.categoria_paraestatal.findFirst({
    where: { nombre: { equals: nombreTrim, mode: "insensitive" } },
  })
  if (existing) return
  const count = await db.categoria_paraestatal.count()
  await db.categoria_paraestatal.create({
    data: { nombre: nombreTrim, orden: count },
  })
}
