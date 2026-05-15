import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const ROLES = [
  "Administrador",
  "Director Operativo",
  "Analista",
  "Revisor",
  "Capturista",
  "Enlace DO",
  "Enlace DGRH",
  "Consulta",
]

export async function seedRoles(prisma: PrismaClient) {
  for (const nombre of ROLES) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre, activo: true },
    })
  }
  console.log(`Roles: ${ROLES.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("roles", seedRoles)
}
