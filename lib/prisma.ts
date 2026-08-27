import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    // Default de `pg` es 10: con varios usuarios conectados a la vez, una sola
    // actualización dispara un refetch por cada pestaña abierta (ver
    // broadcastUpdate en lib/sse-manager.ts) y esas 10 conexiones se agotan
    // rápido, dejando el resto de las peticiones (incluido "Enviar a
    // Validación") esperando en fila hasta parecer colgadas.
    max: 30,
  })
  return new PrismaClient({ adapter, log: ["error"] })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
