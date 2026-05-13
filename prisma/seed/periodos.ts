import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const EJERCICIO = 2026

export async function seedPeriodos(prisma: PrismaClient) {
  for (let mes = 1; mes <= 12; mes++) {
    const inicio = new Date(EJERCICIO, mes - 1, 1)
    const fin = new Date(EJERCICIO, mes, 0)
    await prisma.periodo.upsert({
      where: { mes_anio: { mes, anio: EJERCICIO } },
      update: {},
      create: { mes, anio: EJERCICIO, fecha_inicio: inicio, fecha_fin: fin, activo: true },
    })
  }
  console.log(`Periodos ${EJERCICIO}: 12`)
}

if (isMain(import.meta.url)) {
  runStandalone("periodos", seedPeriodos)
}
