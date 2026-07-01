import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q     = searchParams.get("q")?.trim() ?? ""
    const page  = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")))
    const skip  = (page - 1) * limit

    const searchWhere = q
      ? `AND (
          cj.programa_proyecto         ILIKE $1 OR
          cj.tipo_actividad            ILIKE $1 OR
          cj.denominacion_nombramiento ILIKE $1 OR
          cj.vigencia                  ILIKE $1 OR
          cj.regimen_contratacion      ILIKE $1
        )`
      : ""

    const countParams: any[] = q ? [`%${q}%`] : []
    const queryParams: any[] = q ? [`%${q}%`, limit, skip] : [limit, skip]

    const countSql = `
      SELECT COUNT(*) AS total
      FROM catalogo_justificacion cj
      WHERE cj.activo = true ${searchWhere}
    `

    const listSql = `
      SELECT
        cj.id,
        cj.solicitud_id,
        cj.regimen_contratacion,
        cj.programa_proyecto,
        cj.tipo_actividad,
        cj.denominacion_nombramiento,
        cj.puesto_jefe_inmediato,
        cj.numero_personas,
        cj.tipo_pago,
        cj.importe_bruto,
        cj.importe_neto,
        cj.vigencia,
        cj.archivo_pdf_sin_firmas,
        cj.activo,
        cj.creado_en,
        s.id                    AS sol_id,
        s.tipo_solicitud        AS sol_tipo,
        s.folio_recepcion       AS sol_folio_recepcion,
        s.folio_dictamen        AS sol_folio_dictamen,
        s.secretaria            AS sol_secretaria,
        s.secretaria_txt_snapshot AS sol_secretaria_txt,
        (SELECT COUNT(*) FROM catalogo_solicitud cs2 WHERE cs2.catalogo_justificacion_id = cj.id) AS sol_count
      FROM catalogo_justificacion cj
      LEFT JOIN solicitud s ON s.id = cj.solicitud_id
      WHERE cj.activo = true ${searchWhere}
      ORDER BY cj.creado_en DESC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
    `

    const [countRows, rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...countParams),
      prisma.$queryRawUnsafe<any[]>(listSql, ...queryParams),
    ])

    const total = Number(countRows[0]?.total ?? 0)

    const records = rows.map((r: any) => ({
      id:                       Number(r.id),
      solicitud_id:             Number(r.solicitud_id),
      regimen_contratacion:     r.regimen_contratacion,
      programa_proyecto:        r.programa_proyecto,
      tipo_actividad:           r.tipo_actividad,
      denominacion_nombramiento: r.denominacion_nombramiento,
      puesto_jefe_inmediato:    r.puesto_jefe_inmediato,
      numero_personas:          r.numero_personas,
      tipo_pago:                r.tipo_pago,
      importe_bruto:            r.importe_bruto,
      importe_neto:             r.importe_neto,
      vigencia:                 r.vigencia,
      archivo_pdf_sin_firmas:   r.archivo_pdf_sin_firmas,
      activo:                   r.activo,
      creado_en:                r.creado_en,
      solicitud: {
        id:                     Number(r.sol_id),
        tipo_solicitud:         r.sol_tipo ?? "",
        folio_recepcion:        r.sol_folio_recepcion,
        folio_dictamen:         r.sol_folio_dictamen,
        secretaria:             r.sol_secretaria,
        secretaria_txt_snapshot: r.sol_secretaria_txt,
      },
      _count: { catalogo_solicitudes: Number(r.sol_count ?? 0) },
    }))

    return NextResponse.json({ records, total, page, limit })
  } catch (e) {
    console.error("[GET /api/catalogo-justificaciones]", e)
    return NextResponse.json({ error: "Error al consultar catálogo" }, { status: 500 })
  }
}
