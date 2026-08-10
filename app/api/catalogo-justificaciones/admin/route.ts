import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRol } from "@/lib/api-guard"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const guardError = await requireRol(userId, ["Administrador"])
    if (guardError) return guardError

    // El catálogo se acota al ámbito del usuario: centralizado (registros sin
    // tipo se tratan como centralizada) o paraestatal.
    const viewer = userId
      ? await prisma.usuario.findUnique({
          where:  { id: userId },
          select: { organo_centralizado: { select: { id: true } } },
        })
      : null
    const esCentralizada = !!viewer?.organo_centralizado

    const q         = searchParams.get("q")?.trim() ?? ""
    const page      = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const limitRaw  = searchParams.get("limit") ?? "20"
    // limit=all (o 0) trae todos los registros sin paginar (carga ilimitada).
    const noLimit   = limitRaw === "all" || limitRaw === "0"
    const limit     = noLimit ? 0 : Math.max(1, Number(limitRaw))
    const skip      = noLimit ? 0 : (page - 1) * limit

    // El rol Administrador ve el catálogo completo (todas las secretarías).
    // La pestaña de Consulta sigue limitada por secretaría
    // (app/api/catalogo-justificaciones/route.ts).
    const conditions: string[] = []
    const params: any[] = []

    conditions.push(
      esCentralizada
        ? `COALESCE(cj.tipo_administracion, 'centralizada') <> 'paraestatal'`
        : `cj.tipo_administracion = 'paraestatal'`
    )

    if (q) {
      params.push(`%${q}%`)
      const qIdx = params.length
      conditions.push(`(
        cj.programa_proyecto        ILIKE $${qIdx} OR
        cj.tipo_actividad           ILIKE $${qIdx} OR
        cj.denominacion_nombramiento ILIKE $${qIdx} OR
        cj.vigencia                 ILIKE $${qIdx} OR
        cj.regimen_contratacion     ILIKE $${qIdx}
      )`)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    // Raw SQL para evitar el cliente Prisma cacheado
    const countSql = `
      SELECT COUNT(*) AS total
      FROM catalogo_justificacion cj
      LEFT JOIN solicitud s ON s.id = cj.solicitud_id
      ${whereClause}
    `

    const listParams = noLimit ? [...params] : [...params, limit, skip]
    const paginationSql = noLimit
      ? ""
      : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

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
        cj.actualizado_en,
        s.id                                           AS sol_id,
        COALESCE(cj.tipo_solicitud, s.tipo_solicitud)   AS sol_tipo,
        COALESCE(cj.folio_recepcion, s.folio_recepcion) AS sol_folio_recepcion,
        COALESCE(cj.folio_dictamen, s.folio_dictamen)   AS sol_folio_dictamen,
        COALESCE(cj.secretaria, s.secretaria)           AS sol_secretaria,
        COALESCE(cj.secretaria_txt_snapshot, s.secretaria_txt_snapshot) AS sol_secretaria_txt
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
      ${paginationSql}
    `

    const [countRows, rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...params),
      prisma.$queryRawUnsafe<any[]>(listSql, ...listParams),
    ])

    const total = Number(countRows[0]?.total ?? 0)

    // Para cada catalogo_justificacion obtener sus catalogo_solicitudes
    const cjIds = rows.map((r: any) => Number(r.id))

    let solsMap: Record<number, any[]> = {}
    if (cjIds.length > 0) {
      const solsRows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          cs.id,
          cs.catalogo_justificacion_id,
          cs.nueva_vigencia,
          cs.nuevo_numero_personas,
          cs.nuevos_numero_prestadores,
          cs.procesado,
          cs.procesado_en,
          cs.solicitud_nueva_id,
          cs.creado_en,
          u.nombre  AS usuario_nombre,
          u.rfc     AS usuario_rfc,
          s.folio_justificacion AS folio_nueva
        FROM catalogo_solicitud cs
        JOIN usuario u ON u.id = cs.usuario_id
        LEFT JOIN solicitud s ON s.id = cs.solicitud_nueva_id
        WHERE cs.catalogo_justificacion_id IN (${cjIds.join(",")})
        ORDER BY cs.creado_en DESC
      `)
      for (const sol of solsRows) {
        const cjId = Number(sol.catalogo_justificacion_id)
        if (!solsMap[cjId]) solsMap[cjId] = []
        solsMap[cjId].push({
          id:                       Number(sol.id),
          nueva_vigencia:           sol.nueva_vigencia,
          nuevo_numero_personas:    sol.nuevo_numero_personas,
          nuevos_numero_prestadores: sol.nuevos_numero_prestadores,
          procesado:                sol.procesado,
          procesado_en:             sol.procesado_en,
          solicitud_nueva_id:       sol.solicitud_nueva_id,
          folio_nueva:              sol.folio_nueva ?? null,
          creado_en:                sol.creado_en,
          usuario: { nombre: sol.usuario_nombre, rfc: sol.usuario_rfc },
        })
      }
    }

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
        tipo_solicitud:         r.sol_tipo,
        folio_recepcion:        r.sol_folio_recepcion,
        folio_dictamen:         r.sol_folio_dictamen,
        secretaria:             r.sol_secretaria,
        secretaria_txt_snapshot: r.sol_secretaria_txt,
      },
      _count: { catalogo_solicitudes: (solsMap[Number(r.id)] ?? []).length },
      catalogo_solicitudes: solsMap[Number(r.id)] ?? [],
    }))

    return NextResponse.json({ records, total, page, limit })
  } catch (e) {
    console.error("[GET /api/catalogo-justificaciones/admin]", e)
    return NextResponse.json({ error: "Error al consultar catálogo (admin)" }, { status: 500 })
  }
}
