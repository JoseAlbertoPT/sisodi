import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const ACCIONES = ["Ver", "Crear", "Editar", "Eliminar"]

export async function seedAcciones(prisma: PrismaClient) {
  for (let i = 0; i < ACCIONES.length; i++) {
    const id = i + 1
    await prisma.accion.upsert({
      where: { id },
      update: { nombre: ACCIONES[i] },
      create: { id, nombre: ACCIONES[i] },
    })
  }
  console.log(`Acciones: ${ACCIONES.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("acciones", seedAcciones)
}
