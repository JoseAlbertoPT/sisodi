import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

export const ESTADOS = [
  "En Captura",
  "Borrador",
  "En Validacion Justificaciones",
  "Observado por Validacion",
  "En Revision Revisor",
  "Observado por Revisor",
  "Pendiente Firma Justificacion",
  "Pendiente Firma Revision",
  "Pendiente Firma Validacion",
  "Pendiente Firma Emisor",
  "En Validacion Final",
  "Observado por Validacion Final",
  "En Revision Emisor",
  "Observado por Emisor",
  "Pendiente Firma Dictamen",
  "Emitido",
  "Rechazado",
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
