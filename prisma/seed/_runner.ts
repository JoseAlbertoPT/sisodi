import "dotenv/config"
import { fileURLToPath } from "url"
import { prisma } from "../../lib/prisma"
import type { PrismaClient } from "../../lib/generated/prisma"

export type SeedFn = (prisma: PrismaClient) => Promise<void>

export function isMain(metaUrl: string) {
  return process.argv[1] === fileURLToPath(metaUrl)
}

export async function runStandalone(name: string, fn: SeedFn) {
  try {
    await fn(prisma)
    console.log(`✓ seed ${name} completado`)
  } catch (e) {
    console.error(`✗ seed ${name} falló`, e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}
