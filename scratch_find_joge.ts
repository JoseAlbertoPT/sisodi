import { prisma } from "./lib/prisma"

async function main() {
  const sols = await prisma.solicitud.findMany({
    where: { secretaria: { contains: "Gubernatura", mode: "insensitive" } },
    select: {
      id: true, folio_dictamen: true, folio_recepcion: true, secretaria: true,
      firma_proceso: { select: { uuid: true, id: true } },
    },
    orderBy: { id: "desc" },
    take: 10,
  })
  console.log(JSON.stringify(sols, null, 2))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
