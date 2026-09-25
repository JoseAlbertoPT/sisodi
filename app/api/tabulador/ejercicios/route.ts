import { NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

/**
 * Años para Configuración > Tabulador:
 * - `ejercicios`: años que ya tienen tabulador (selector de año).
 * - `disponiblesPlantilla`: años con Calendario que aún no tienen tabulador —
 *   los únicos para los que se puede "Crear nueva plantilla".
 */
export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const [tab, cal] = await Promise.all([
      prisma.tabulador.findMany({ distinct: ["ejercicio"], select: { ejercicio: true }, orderBy: { ejercicio: "asc" } }),
      prisma.calendario.findMany({ distinct: ["ejercicio"], select: { ejercicio: true }, orderBy: { ejercicio: "asc" } }),
    ])
    const ejercicios = tab.map((r) => r.ejercicio)
    const conTabulador = new Set(ejercicios)
    const disponiblesPlantilla = cal.map((r) => r.ejercicio).filter((y) => !conTabulador.has(y))
    return NextResponse.json({ ok: true, ejercicios, disponiblesPlantilla })
  } catch (e) {
    console.error("[GET /api/tabulador/ejercicios]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
