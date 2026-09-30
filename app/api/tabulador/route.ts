import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, CONFIGURACION_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

function mapRow(r: { id: number; ejercicio: number; nivel: string; categoria: string; importe_bruto_min: unknown; importe_bruto_max: unknown; secretarias: string[] }) {
  return {
    id: r.id,
    ejercicio: r.ejercicio,
    nivel: r.nivel,
    categoria: r.categoria,
    importeBrutoMin: Number(r.importe_bruto_min),
    importeBrutoMax: Number(r.importe_bruto_max),
    secretarias: r.secretarias,
  }
}

function parseSecretarias(body: unknown): string[] {
  const raw = (body as { secretarias?: unknown } | null)?.secretarias
  if (!Array.isArray(raw)) return []
  const limpio = raw.map((s) => String(s).trim()).filter(Boolean)
  return [...new Set(limpio)]
}

function mismasSecretarias(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/** Año válido (2020–2099) o null. */
function parseEjercicio(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 2020 && n <= 2099 ? n : null
}

/** `?ejercicio=YYYY` (por defecto el año en curso): tabulador de ese año. */
export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const param = req.nextUrl.searchParams.get("ejercicio")
    const ejercicio = param ? parseEjercicio(param) : new Date().getFullYear()
    if (!ejercicio) return NextResponse.json({ ok: false, error: "Año inválido" }, { status: 400 })

    const rows = await prisma.tabulador.findMany({ where: { ejercicio }, orderBy: [{ nivel: "asc" }, { categoria: "asc" }] })
    return NextResponse.json({ ok: true, ejercicio, tabulador: rows.map(mapRow) })
  } catch (e) {
    console.error("[GET /api/tabulador]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const body = await req.json().catch(() => null)
    const ejercicio = parseEjercicio(body?.ejercicio)
    const nivel = String(body?.nivel ?? "").trim()
    const categoria = String(body?.categoria ?? "").trim()
    const importeBrutoMin = Number(body?.importeBrutoMin)
    const importeBrutoMax = Number(body?.importeBrutoMax)
    const secretarias = parseSecretarias(body)

    if (!ejercicio) {
      return NextResponse.json({ ok: false, error: "El año del tabulador es requerido" }, { status: 400 })
    }
    if (!nivel || !categoria) {
      return NextResponse.json({ ok: false, error: "Nivel y categoría son requeridos" }, { status: 400 })
    }
    if (!Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
      return NextResponse.json({ ok: false, error: "Importe bruto mínimo y máximo deben ser numéricos" }, { status: 400 })
    }
    if (importeBrutoMin > importeBrutoMax) {
      return NextResponse.json({ ok: false, error: "El importe mínimo no puede ser mayor al máximo" }, { status: 400 })
    }

    // El tabulador de un año nuevo solo se crea si ese año ya tiene Calendario.
    const candidatos = await prisma.tabulador.findMany({ where: { ejercicio, nivel, categoria } })
    if (candidatos.length === 0) {
      const [yaTieneTabulador, tieneCalendario] = await Promise.all([
        prisma.tabulador.count({ where: { ejercicio } }),
        prisma.calendario.count({ where: { ejercicio } }),
      ])
      if (yaTieneTabulador === 0 && tieneCalendario === 0) {
        return NextResponse.json(
          { ok: false, error: `No existe el Calendario ${ejercicio}. Créelo primero en Configuración > Calendario.` },
          { status: 400 },
        )
      }
    }
    if (candidatos.some((c) => mismasSecretarias(c.secretarias, secretarias))) {
      return NextResponse.json({ ok: false, error: `Ya existe un registro para el nivel ${nivel} / categoría ${categoria} con el mismo alcance de Secretaría en ${ejercicio}` }, { status: 409 })
    }

    const row = await prisma.tabulador.create({
      data: { ejercicio, nivel, categoria, importe_bruto_min: importeBrutoMin, importe_bruto_max: importeBrutoMax, secretarias },
    })
    broadcastUpdate(["tabulador"])
    return NextResponse.json({ ok: true, row: mapRow(row) }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/tabulador]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
