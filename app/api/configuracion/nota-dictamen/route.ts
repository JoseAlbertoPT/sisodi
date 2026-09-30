import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, CONFIGURACION_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { aniosNotaDictamen, claveNotaDictamen, getNotaDictamen, setTextoConfiguracion } from "@/lib/configuracion-texto"

function parseEjercicio(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 2020 && n <= 2099 ? n : null
}

/**
 * `?ejercicio=YYYY` (por defecto el año en curso): nota de ese año.
 * También regresa los años con nota (`ejercicios`) y los años con Calendario
 * que aún no tienen nota (`disponiblesNueva`) — los únicos para "Nueva nota".
 */
export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const param = req.nextUrl.searchParams.get("ejercicio")
    const ejercicio = param ? parseEjercicio(param) : new Date().getFullYear()
    if (!ejercicio) return NextResponse.json({ ok: false, error: "Año inválido" }, { status: 400 })

    const [nota, ejercicios, cal] = await Promise.all([
      getNotaDictamen(ejercicio),
      aniosNotaDictamen(),
      prisma.calendario.findMany({ distinct: ["ejercicio"], select: { ejercicio: true }, orderBy: { ejercicio: "asc" } }),
    ])
    const conNota = new Set(ejercicios)
    const disponiblesNueva = cal.map((r) => r.ejercicio).filter((y) => !conNota.has(y))
    return NextResponse.json({ ok: true, ejercicio, valor: nota.valor, existe: nota.existe, ejercicios, disponiblesNueva })
  } catch (e) {
    console.error("[GET /api/configuracion/nota-dictamen]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

/** `{ ejercicio, valor }`. La nota de un año nuevo solo se crea si ese año ya tiene Calendario. */
export async function PUT(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const body = await req.json().catch(() => ({}))
    const valor = body?.valor
    const ejercicio = body?.ejercicio !== undefined ? parseEjercicio(body.ejercicio) : new Date().getFullYear()
    if (!ejercicio) {
      return NextResponse.json({ ok: false, error: "Año inválido" }, { status: 400 })
    }
    if (typeof valor !== "string" || valor.trim() === "") {
      return NextResponse.json({ ok: false, error: "El texto de la nota es requerido" }, { status: 400 })
    }

    const { existe } = await getNotaDictamen(ejercicio)
    if (!existe) {
      const tieneCalendario = await prisma.calendario.count({ where: { ejercicio } })
      if (tieneCalendario === 0) {
        return NextResponse.json(
          { ok: false, error: `No existe el Calendario ${ejercicio}. Créelo primero en la pestaña Calendario.` },
          { status: 400 },
        )
      }
    }

    const guardado = await setTextoConfiguracion(claveNotaDictamen(ejercicio), valor.trim())
    return NextResponse.json({ ok: true, ejercicio, valor: guardado })
  } catch (e) {
    console.error("[PUT /api/configuracion/nota-dictamen]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
