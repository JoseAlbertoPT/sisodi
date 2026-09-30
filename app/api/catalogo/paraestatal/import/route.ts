import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, ENTIDADES_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"

interface ImportRow {
  organismo: string
  area: string
}

function normNombre(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, ENTIDADES_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const { rows } = await req.json() as { rows: ImportRow[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Sin filas para importar" }, { status: 400 })
    }

    const valid = rows.filter((r) => r.organismo?.trim() && r.area?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene filas válidas" }, { status: 400 })
    }

    const existingOrganismos = await prisma.categoria_paraestatal.findMany({ include: { organos: true } })
    const organismosByName = new Map<string, typeof existingOrganismos[number]>()
    const areasPorOrganismo = new Map<number, Set<string>>()
    for (const o of existingOrganismos) {
      organismosByName.set(normNombre(o.nombre), o)
      areasPorOrganismo.set(o.id, new Set(o.organos.map((a) => normNombre(a.nombre))))
    }

    let organismosOrden = existingOrganismos.length
    let organismosCreados = 0
    let areasCreadas = 0
    const saltadas: { organismo: string; area: string; motivo: string }[] = []

    const result = await prisma.$transaction(async (tx) => {
      for (const row of valid) {
        const organismoNombre = row.organismo.trim()
        const areaNombre = row.area.trim()
        const organismoKey = normNombre(organismoNombre)

        let organismo = organismosByName.get(organismoKey)
        if (!organismo) {
          const created = await tx.categoria_paraestatal.create({
            data: { nombre: organismoNombre, orden: organismosOrden++ },
          })
          organismo = { ...created, organos: [] }
          organismosByName.set(organismoKey, organismo)
          areasPorOrganismo.set(organismo.id, new Set())
          organismosCreados++
        }

        const areaSet = areasPorOrganismo.get(organismo.id)!
        if (areaSet.has(normNombre(areaNombre))) {
          saltadas.push({ organismo: organismoNombre, area: areaNombre, motivo: "Ya existe un área con ese nombre en este organismo" })
          continue
        }

        await tx.organo_paraestatal.create({
          data: { nombre: areaNombre, categoria_id: organismo.id, orden: areaSet.size },
        })
        areaSet.add(normNombre(areaNombre))
        areasCreadas++
      }
      return { organismosCreados, areasCreadas, saltadas }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/paraestatal/import]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
