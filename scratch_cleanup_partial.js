const { PrismaPg } = require("@prisma/adapter-pg")
const { PrismaClient } = require("./lib/generated/prisma")
require("dotenv").config()

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  const rows = await prisma.solicitud.findMany({
    where: { secretaria_txt_snapshot: { not: null } },
    select: { id: true, folio_dictamen: true, secretaria_txt_snapshot: true, fecha_creacion: true },
    orderBy: { id: "asc" },
  })
  console.log(`Encontradas ${rows.length} solicitudes de la corrida parcial:`)
  console.log(rows.map(r => `  id=${r.id} folio=${r.folio_dictamen} sec=${r.secretaria_txt_snapshot} creada=${r.fecha_creacion}`).join("\n"))
  const ids = rows.map(r => r.id)
  const del = await prisma.solicitud.deleteMany({ where: { id: { in: ids } } })
  console.log(`Eliminadas: ${del.count}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
