import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

// Datos que antes vivían hardcodeados en lib/tabulador.ts (RANGOS_TABULADOR).
// Los niveles comentados ahí (105, 504) se dejan fuera a propósito — nunca
// estuvieron activos en el formulario.
const RANGOS: { nivel: string; categoria: string; min: number; max: number }[] = [
  { nivel: "106", categoria: "A a C", min: 24380.00, max: 32123.30 },
  { nivel: "107", categoria: "A a C", min: 19080.00, max: 24369.40 },
  { nivel: "108", categoria: "A a C", min: 0.00,     max: 18830.90 },
  { nivel: "109", categoria: "A a C", min: 0.00,     max: 13292.40 },
  { nivel: "301", categoria: "A",     min: 11660.00, max: 15898.94 },
  { nivel: "302", categoria: "A",     min: 10554.00, max: 11658.94 },
  { nivel: "303", categoria: "A",     min: 0.00,     max: 10553.36 },
  { nivel: "505", categoria: "A a B", min: 0.00,     max: 47631.00 },
  { nivel: "506", categoria: "A a B", min: 0.00,     max: 44308.00 },
  { nivel: "507", categoria: "A a B", min: 0.00,     max: 40985.00 },
  { nivel: "508", categoria: "A a B", min: 0.00,     max: 36554.00 },
  { nivel: "509", categoria: "A a B", min: 0.00,     max: 33231.00 },
  { nivel: "510", categoria: "A a B", min: 0.00,     max: 31569.00 },
]

export async function seedTabulador(prisma: PrismaClient) {
  // Todos aplican a todas las Secretarías (secretarias: []).
  for (const r of RANGOS) {
    const existente = await prisma.tabulador.findFirst({ where: { nivel: r.nivel, categoria: r.categoria, secretarias: { isEmpty: true } } })
    if (existente) {
      await prisma.tabulador.update({ where: { id: existente.id }, data: { importe_bruto_min: r.min, importe_bruto_max: r.max } })
    } else {
      await prisma.tabulador.create({ data: { nivel: r.nivel, categoria: r.categoria, importe_bruto_min: r.min, importe_bruto_max: r.max } })
    }
  }
  console.log(`Tabulador: ${RANGOS.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("tabulador", seedTabulador)
}
