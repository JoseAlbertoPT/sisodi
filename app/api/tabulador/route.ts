import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

function mapRow(r: { id: number; nivel: string; categoria: string; importe_bruto_min: unknown; importe_bruto_max: unknown; secretarias: string[] }) {
  return {
    id: r.id,
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

export async function GET() {
  try {
    const rows = await prisma.tabulador.findMany({ orderBy: [{ nivel: "asc" }, { categoria: "asc" }] })
    return NextResponse.json({ ok: true, tabulador: rows.map(mapRow) })
  } catch (e) {
    console.error("[GET /api/tabulador]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const candidatos = await prisma.tabulador.findMany({ where: { nivel, categoria } })
    if (candidatos.some((c) => mismasSecretarias(c.secretarias, secretarias))) {
      return NextResponse.json({ ok: false, error: `Ya existe un registro para el nivel ${nivel} / categoría ${categoria} con el mismo alcance de Secretaría` }, { status: 409 })
    }

    const row = await prisma.tabulador.create({
      data: { nivel, categoria, importe_bruto_min: importeBrutoMin, importe_bruto_max: importeBrutoMax, secretarias },
    })
    broadcastUpdate(["tabulador"])
    return NextResponse.json({ ok: true, row: mapRow(row) }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/tabulador]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
