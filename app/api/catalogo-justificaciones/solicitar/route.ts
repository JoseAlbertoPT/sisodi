import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { requireCatalogoConsulta } from "@/lib/api-guard"
import { validarVigencia, parseFechaLocal } from "@/lib/vigencia"
import { generarFolioCatalogo, tipoFolioPorRegimen } from "@/lib/folio-catalogo"
import { REGIMEN_PERMISO_CATALOGO, prefijoPermisoCatalogo } from "@/lib/permiso-catalogo"
import { otorgadoMinimoVigente } from "@/lib/permiso-expiracion"

function parseVigenciaRango(nuevaVigencia: string): { inicio: Date; fin: Date } | null {
  const [inicioStr, finStr] = nuevaVigencia.split("/").map((s) => s.trim())
  if (!inicioStr || !finStr) return null
  const inicio = parseFechaLocal(inicioStr)
  const fin = parseFechaLocal(finStr)
  if (!inicio || !fin) return null
  return { inicio, fin }
}

// Límite máximo al reutilizar un registro: Seguridad Pública permite hasta
// 100 prestadores; el resto de las secretarías, hasta 50.
function maxPrestadoresPermitido(secretaria: string | null | undefined): number {
  const s = (secretaria ?? "").toLowerCase()
  return s.includes("seguridad p") ? 100 : 50
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const body = await req.json()
    const {
      catalogo_justificacion_id,
      usuario_id,
      nueva_vigencia,
      nuevo_numero_personas,
      nuevos_numero_prestadores,
      nuevo_importe_bruto,
      tipo,
      programa_anterior,
      nuevo_programa_proyecto,
    } = body

    if (!catalogo_justificacion_id || !usuario_id || !nueva_vigencia?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const guardError = await requireCatalogoConsulta(String(usuario_id))
    if (guardError) return guardError

    // La cancelación no captura número de prestadores/personas, solo vigencia.
    // La reutilización puede incluir, opcionalmente, un cambio de
    // Programa/Proyecto en la misma solicitud (antes era una acción "Programa"
    // separada; ahora ambas se capturan juntas).
    const tipoNormalizado = tipo === "cancelacion" ? "cancelacion" : "reutilizacion"
    const esCancelacion = tipoNormalizado === "cancelacion"

    const catalogo = await prisma.catalogo_justificacion.findUnique({
      where: { id: Number(catalogo_justificacion_id) },
    })
    if (!catalogo) {
      return NextResponse.json({ error: "Registro de catálogo no encontrado" }, { status: 404 })
    }

    // Con permiso "Captura catálogo" para este folio (lib/permiso-catalogo.ts)
    // la vigencia puede pasar de 6 meses; el permiso solo se gasta si de
    // verdad se usó (si la vigencia cabe en 6 meses, se conserva).
    let permisoCatalogoId: number | null = null
    if (!esCancelacion) {
      const rango = parseVigenciaRango(String(nueva_vigencia).trim())
      if (!rango) {
        return NextResponse.json({ error: "Formato de vigencia inválido" }, { status: 400 })
      }
      const validacion = validarVigencia(rango.inicio, rango.fin)
      if (!validacion.ok) {
        const permiso = await prisma.permiso_captura.findFirst({
          where: {
            usuario_id: sesion.id,
            regimen:    REGIMEN_PERMISO_CATALOGO,
            periodo:    { startsWith: prefijoPermisoCatalogo(Number(catalogo_justificacion_id)) },
            active:     true,
            used:       false,
            granted_at: { gt: otorgadoMinimoVigente() },
          },
          select: { id: true },
        })
        const validacionExtendida = permiso ? validarVigencia(rango.inicio, rango.fin, { sinLimiteSeisMeses: true }) : validacion
        if (!validacionExtendida.ok) {
          return NextResponse.json({ error: validacionExtendida.error }, { status: 400 })
        }
        permisoCatalogoId = permiso?.id ?? null
      }
    }

    if (!esCancelacion && nuevos_numero_prestadores) {
      const maxPrestadores = maxPrestadoresPermitido(catalogo.secretaria_txt_snapshot ?? catalogo.secretaria)
      if (Number(nuevos_numero_prestadores) > maxPrestadores) {
        return NextResponse.json(
          { error: `El número de prestadores no puede exceder ${maxPrestadores} para esta secretaría` },
          { status: 400 },
        )
      }
    }

    if (!esCancelacion && nuevo_importe_bruto) {
      const importe = Number(nuevo_importe_bruto)
      if (!Number.isFinite(importe) || importe <= 0) {
        return NextResponse.json({ error: "Importe bruto inválido" }, { status: 400 })
      }
    }

    // Folio actual del dictamen (NN/MM/AAAA-CH|CA). Se toma el consecutivo y se
    // guarda la fila en una sola transacción: si algo falla no queda hueco.
    // Un régimen que no es Honorarios ni Asimilados no lleva folio nuevo
    // (sigue con el formato anterior "folio de origen-N").
    const tipoFolio = tipoFolioPorRegimen(catalogo.regimen_contratacion)
    const record = await prisma.$transaction(async (tx) => tx.catalogo_solicitud.create({
      data: {
        ...(tipoFolio ? await generarFolioCatalogo(tx, tipoFolio) : {}),
        catalogo_justificacion_id: Number(catalogo_justificacion_id),
        usuario_id: String(usuario_id),
        nueva_vigencia: String(nueva_vigencia).trim(),
        nuevo_numero_personas: esCancelacion || !nuevo_numero_personas ? null : Number(nuevo_numero_personas),
        nuevos_numero_prestadores: esCancelacion || !nuevos_numero_prestadores ? null : Number(nuevos_numero_prestadores),
        nuevo_importe_bruto: esCancelacion || !nuevo_importe_bruto ? null : Number(nuevo_importe_bruto),
        tipo: tipoNormalizado,
        programa_anterior: esCancelacion || !nuevo_programa_proyecto ? null : (String(programa_anterior ?? "").trim() || null),
        nuevo_programa_proyecto: esCancelacion || !nuevo_programa_proyecto ? null : String(nuevo_programa_proyecto).trim(),
      },
    }))

    if (permisoCatalogoId != null) {
      await prisma.permiso_captura.update({
        where: { id: permisoCatalogoId },
        data:  { active: false, used: true, consumed_at: new Date() },
      })
      broadcastUpdate(["permisos-captura"])
    }
    broadcastUpdate(["catalogo"])

    return NextResponse.json({ record }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/solicitar]", e)
    return NextResponse.json({ error: "Error al crear solicitud de reutilización" }, { status: 500 })
  }
}
