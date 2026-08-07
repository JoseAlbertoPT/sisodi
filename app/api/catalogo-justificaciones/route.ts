import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q      = searchParams.get("q")?.trim() ?? ""
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const limit  = Math.min(1000, Math.max(1, Number(searchParams.get("limit") ?? "20")))
    const skip   = (page - 1) * limit
    const userId = searchParams.get("userId")

    // Solo se listan registros de la secretaría del usuario que consulta.
    // Se compara por el nombre de la secretaría de nivel superior (antes del " > ")
    // ya que la columna plana `secretaria` siempre trae el nombre limpio, sin
    // depender de si la solicitud original se creó como centralizada o paraestatal.
    const viewer = userId
      ? await prisma.usuario.findUnique({
          where:  { id: userId },
          select: {
            secretaria_texto: true,
            organo_centralizado: { select: { nombre: true } },
          },
        })
      : null
    const viewerSecretaria = (viewer?.secretaria_texto ?? viewer?.organo_centralizado?.nombre ?? "")
      .split(">")[0]
      .trim()

    if (!viewerSecretaria) {
      return NextResponse.json({ records: [], total: 0, page, limit })
    }

    const conditions = ["cj.activo = true"]
    const params: any[] = [viewerSecretaria]
    conditions.push(`lower(trim(split_part(COALESCE(cj.secretaria, s.secretaria), '>', 1))) = lower($1)`)

    if (q) {
      params.push(`%${q}%`)
      const qIdx = params.length
      conditions.push(`(
        cj.programa_proyecto         ILIKE $${qIdx} OR
        cj.tipo_actividad            ILIKE $${qIdx} OR
        cj.denominacion_nombramiento ILIKE $${qIdx} OR
        cj.vigencia                  ILIKE $${qIdx} OR
        cj.regimen_contratacion      ILIKE $${qIdx}
      )`)
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`

    const countSql = `
      SELECT COUNT(*) AS total
      FROM catalogo_justificacion cj
      LEFT JOIN solicitud s ON s.id = cj.solicitud_id
      ${whereClause}
    `

    const listParams = [...params, limit, skip]
    const limitIdx  = params.length + 1
    const offsetIdx = params.length + 2

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
        s.id                                          AS sol_id,
        COALESCE(cj.tipo_solicitud, s.tipo_solicitud)  AS sol_tipo,
        COALESCE(cj.folio_recepcion, s.folio_recepcion) AS sol_folio_recepcion,
        COALESCE(cj.folio_dictamen, s.folio_dictamen)  AS sol_folio_dictamen,
        COALESCE(cj.secretaria, s.secretaria)          AS sol_secretaria,
        COALESCE(cj.secretaria_txt_snapshot, s.secretaria_txt_snapshot) AS sol_secretaria_txt,
        (SELECT COUNT(*) FROM catalogo_solicitud cs2 WHERE cs2.catalogo_justificacion_id = cj.id) AS sol_count
      FROM catalogo_justificacion cj
      LEFT JOIN solicitud s ON s.id = cj.solicitud_id
      ${whereClause}
      ORDER BY GREATEST(
        cj.creado_en,
        COALESCE((
          SELECT MAX(cs.creado_en)
          FROM catalogo_solicitud cs
          WHERE cs.catalogo_justificacion_id = cj.id
        ), cj.creado_en)
      ) DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `

    const [countRows, rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...params),
      prisma.$queryRawUnsafe<any[]>(listSql, ...listParams),
    ])

    const total = Number(countRows[0]?.total ?? 0)

    const records = rows.map((r: any) => ({
      id:                       Number(r.id),
      solicitud_id:             r.solicitud_id != null ? Number(r.solicitud_id) : null,
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
        id:                     r.sol_id != null ? Number(r.sol_id) : null,
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
