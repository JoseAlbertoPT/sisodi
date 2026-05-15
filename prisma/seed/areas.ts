import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const AREAS = [
  { id: 1, nombre: "Dirección de Organización" },
]

export async function seedAreas(prisma: PrismaClient) {
  for (const a of AREAS) {
    await prisma.area.upsert({
      where: { id: a.id },
      update: { nombre: a.nombre, activo: true },
      create: { id: a.id, nombre: a.nombre, activo: true },
    })
  }
  console.log(`Áreas: ${AREAS.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("areas", seedAreas)
}
