import { NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

/** Años (ejercicios) que tienen calendario guardado, para el selector de Configuración > Calendario. */
export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const rows = await prisma.calendario.findMany({
      distinct: ["ejercicio"],
      select:   { ejercicio: true },
      orderBy:  { ejercicio: "asc" },
    })
    return NextResponse.json({ ejercicios: rows.map((r) => r.ejercicio) })
  } catch (e) {
    console.error("[GET /api/calendario/ejercicios]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
