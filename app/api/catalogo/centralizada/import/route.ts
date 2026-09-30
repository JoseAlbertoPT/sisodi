import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, ENTIDADES_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { ensureOrganismoParaestatal } from "@/lib/sync-organismo-paraestatal"

interface ImportRow {
  secretaria: string
  ua: string
  clave?: string
}

function normNombre(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}
function normClave(s: string): string {
  return s.replace(/\D/g, "")
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

    const valid = rows.filter((r) => r.secretaria?.trim() && r.ua?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene filas válidas" }, { status: 400 })
    }

    const existing = await prisma.organo_centralizado.findMany()
    const secretariasByName = new Map<string, typeof existing[number]>()
    for (const o of existing.filter((o) => o.parent_id === null)) {
      secretariasByName.set(normNombre(o.nombre), o)
    }
    const clavesEnUso = new Set(
      existing.map((o) => normClave(o.ua_clave_administrativa ?? o.clave_reporte_plazas ?? "")).filter(Boolean)
    )
    const uasPorSecretaria = new Map<string, Set<string>>()
    for (const o of existing.filter((o) => o.parent_id !== null)) {
      const key = o.parent_id!
      if (!uasPorSecretaria.has(key)) uasPorSecretaria.set(key, new Set())
      uasPorSecretaria.get(key)!.add(normNombre(o.nombre))
    }

    let secretariasOrden = existing.filter((o) => o.parent_id === null).length
    let secretariasCreadas = 0
    let uasCreadas = 0
    const saltadas: { secretaria: string; ua: string; motivo: string }[] = []

    const result = await prisma.$transaction(async (tx) => {
      for (const row of valid) {
        const secretariaNombre = row.secretaria.trim()
        const uaNombre = row.ua.trim()
        const claveDigits = normClave(row.clave ?? "")
        const secretariaKey = normNombre(secretariaNombre)

        let secretaria = secretariasByName.get(secretariaKey)
        if (!secretaria) {
          secretaria = await tx.organo_centralizado.create({
            data: { nombre: secretariaNombre, parent_id: null, tipo: "SECRETARIA", orden: secretariasOrden++ },
          })
          secretariasByName.set(secretariaKey, secretaria)
          uasPorSecretaria.set(secretaria.id, new Set())
          secretariasCreadas++
          await ensureOrganismoParaestatal(tx, secretaria.nombre)
        }

        const uaSet = uasPorSecretaria.get(secretaria.id)!
        if (uaSet.has(normNombre(uaNombre))) {
          saltadas.push({ secretaria: secretariaNombre, ua: uaNombre, motivo: "Ya existe una UA con ese nombre en esta secretaría" })
          continue
        }
        if (claveDigits && clavesEnUso.has(claveDigits)) {
          saltadas.push({ secretaria: secretariaNombre, ua: uaNombre, motivo: "La clave ya está asignada a otra unidad administrativa" })
          continue
        }

        await tx.organo_centralizado.create({
          data: {
            nombre: uaNombre,
            parent_id: secretaria.id,
            ua_clave_administrativa: claveDigits || null,
            orden: uaSet.size,
          },
        })
        uaSet.add(normNombre(uaNombre))
        if (claveDigits) clavesEnUso.add(claveDigits)
        uasCreadas++
      }
      return { secretariasCreadas, uasCreadas, saltadas }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/centralizada/import]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
