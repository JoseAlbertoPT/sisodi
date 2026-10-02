import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { puedeGestionarUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"

// Folios de dictamen del Catálogo que un usuario puede reutilizar, para
// otorgarle el permiso "Captura catálogo" (lib/permiso-catalogo.ts). Mismo
// alcance que GET /api/catalogo-justificaciones para ese usuario: su
// secretaría y su ámbito (centralizada / paraestatal), registros activos
// importados del Excel.
export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  if (!(await puedeGestionarUsuarios(sesion.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const usuarioId = req.nextUrl.searchParams.get("usuarioId")
    if (!usuarioId) return NextResponse.json({ error: "Falta usuarioId" }, { status: 400 })

    const usuario = await prisma.usuario.findUnique({
      where:  { id: usuarioId },
      select: { secretaria_texto: true, organo_centralizado: { select: { nombre: true } } },
    })
    const secretaria = (usuario?.secretaria_texto ?? usuario?.organo_centralizado?.nombre ?? "").split(">")[0].trim()
    if (!secretaria) return NextResponse.json({ folios: [] })

    const ambito = usuario?.organo_centralizado
      ? `COALESCE(cj.tipo_administracion, 'centralizada') <> 'paraestatal'`
      : `cj.tipo_administracion = 'paraestatal'`

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT cj.id,
              COALESCE(cj.folio_dictamen, s.folio_dictamen) AS folio_dictamen,
              cj.programa_proyecto,
              cj.regimen_contratacion,
              cj.vigencia
       FROM catalogo_justificacion cj
       LEFT JOIN solicitud s ON s.id = cj.solicitud_id
       WHERE cj.activo = true AND cj.origen = 'excel'
         AND lower(trim(split_part(COALESCE(cj.secretaria, s.secretaria), '>', 1))) = lower($1)
         AND ${ambito}
       ORDER BY cj.creado_en DESC
       LIMIT 1000`,
      secretaria,
    )

    return NextResponse.json({
      folios: rows.map((r) => ({
        id:               Number(r.id),
        folioDictamen:    r.folio_dictamen ?? null,
        programaProyecto: r.programa_proyecto ?? null,
        regimen:          r.regimen_contratacion ?? null,
        vigencia:         r.vigencia ?? null,
      })),
    })
  } catch (e) {
    console.error("[GET /api/permisos-captura/catalogo-folios]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
