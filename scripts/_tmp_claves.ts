import "dotenv/config"
import { prisma } from "../lib/prisma"

async function main() {
  const total = await prisma.organo_centralizado.count()
  const withClave = await prisma.organo_centralizado.count({ where: { clave_reporte_plazas: { not: null } } })
  console.log("total", total, "withClave", withClave)
  const sample = await prisma.organo_centralizado.findMany({
    select: { id: true, nombre: true, clave_reporte_plazas: true, tipo: true, ua_clave_administrativa: true },
    take: 15,
  })
  console.log(JSON.stringify(sample, null, 2))
}
main().finally(() => prisma.$disconnect())
