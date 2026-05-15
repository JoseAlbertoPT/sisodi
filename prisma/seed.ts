import { prisma } from "../lib/prisma"
import { seedRoles } from "./seed/roles"
import { seedAcciones } from "./seed/acciones"
import { seedAreas } from "./seed/areas"
import { seedMenus } from "./seed/menus"
import { seedUsuarios } from "./seed/usuarios"
import { seedEstados } from "./seed/estados"
import { seedPeriodos } from "./seed/periodos"
import { seedCalendario } from "./seed/calendario"
import { seedSecretarias } from "./seed/secretarias"
import { seedParaestatales } from "./seed/paraestatales"

async function main() {
  console.log("== Seed inicial ==")
  await seedRoles(prisma)
  await seedAcciones(prisma)
  await seedAreas(prisma)
  await seedMenus(prisma)
  await seedUsuarios(prisma)
  await seedEstados(prisma)
  await seedPeriodos(prisma)
  await seedCalendario(prisma)
  await seedSecretarias(prisma)
  await seedParaestatales(prisma)
  console.log("== Seed completo ==")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
