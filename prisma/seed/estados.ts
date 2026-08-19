import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const ESTADOS = [
  "Borrador",
  "En Validacion Justificaciones",
  "Observado por Validacion",
  "En Revision Revisor",
  "Observado por Revisor",
  "Pendiente Firma Justificacion",
  "Pendiente Firma Revision",
  "Pendiente Firma Verificacion",
  "Pendiente Firma Emisor",
  "En Verificacion Final",
  "Observado por Verificacion Final",
  "En Revision Emisor",
  "Observado por Emisor",
  "Pendiente Firma Dictamen",
  "Emitido",
]

export async function seedEstados(prisma: PrismaClient) {
  for (const nombre of ESTADOS) {
    await prisma.estado.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }
  console.log(`Estados: ${ESTADOS.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("estados", seedEstados)
}
