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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })

    const body = await req.json().catch(() => null)
    const nivel = String(body?.nivel ?? "").trim()
    const categoria = String(body?.categoria ?? "").trim()
    const importeBrutoMin = Number(body?.importeBrutoMin)
    const importeBrutoMax = Number(body?.importeBrutoMax)
    const secretarias = parseSecretarias(body)

    if (!nivel || !categoria) {
      return NextResponse.json({ ok: false, error: "Nivel y categoría son requeridos" }, { status: 400 })
    }
    if (!Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
      return NextResponse.json({ ok: false, error: "Importe bruto mínimo y máximo deben ser numéricos" }, { status: 400 })
    }
    if (importeBrutoMin > importeBrutoMax) {
      return NextResponse.json({ ok: false, error: "El importe mínimo no puede ser mayor al máximo" }, { status: 400 })
    }

    const actual = await prisma.tabulador.findUnique({ where: { id }, select: { ejercicio: true } })
    if (!actual) return NextResponse.json({ ok: false, error: "Registro no encontrado" }, { status: 404 })

    // Los duplicados se revisan dentro del mismo año del tabulador.
    const candidatos = await prisma.tabulador.findMany({ where: { ejercicio: actual.ejercicio, nivel, categoria, NOT: { id } } })
    if (candidatos.some((c) => mismasSecretarias(c.secretarias, secretarias))) {
      return NextResponse.json({ ok: false, error: `Ya existe otro registro para el nivel ${nivel} / categoría ${categoria} con el mismo alcance de Secretaría` }, { status: 409 })
    }

    const row = await prisma.tabulador.update({
      where: { id },
      data: { nivel, categoria, importe_bruto_min: importeBrutoMin, importe_bruto_max: importeBrutoMax, secretarias },
    })
    broadcastUpdate(["tabulador"])
    return NextResponse.json({ ok: true, row: mapRow(row) })
  } catch (e) {
    console.error("[PUT /api/tabulador/[id]]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })

    await prisma.tabulador.delete({ where: { id } })
    broadcastUpdate(["tabulador"])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/tabulador/[id]]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
