import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"
import { EJERCICIO } from "./periodos"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export async function seedCalendario(prisma: PrismaClient) {
  const rows: { ejercicio: number; regimen: string; periodo: string; limite_do: string; limite_dgrh: string }[] = []

  for (const mes of MESES) {
    const mesIdx = MESES.indexOf(mes) + 1
    const mm = String(mesIdx).padStart(2, "0")

    rows.push({
      ejercicio: EJERCICIO, regimen: "honorarios", periodo: mes,
      limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}`,
    })
    if (mes !== "Enero") {
      rows.push(
        { ejercicio: EJERCICIO, regimen: "asimilados",   periodo: `1ra ${mes}`, limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}` },
        { ejercicio: EJERCICIO, regimen: "nombramiento", periodo: `1ra ${mes}`, limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}` },
      )
    }
    if (mes !== "Diciembre") {
      rows.push(
        { ejercicio: EJERCICIO, regimen: "asimilados",   periodo: `2da ${mes}`, limite_do: `15/${mm}/${EJERCICIO}`, limite_dgrh: `01/${mm}/${EJERCICIO}` },
        { ejercicio: EJERCICIO, regimen: "nombramiento", periodo: `2da ${mes}`, limite_do: `15/${mm}/${EJERCICIO}`, limite_dgrh: `01/${mm}/${EJERCICIO}` },
      )
    }
  }

  await prisma.calendario.deleteMany({ where: { ejercicio: EJERCICIO } })
  await prisma.calendario.createMany({ data: rows })
  console.log(`Calendario ${EJERCICIO}: ${rows.length}`)
}

if (isMain(import.meta.url)) {
  runStandalone("calendario", seedCalendario)
}
