import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { requireCatalogoConsulta } from "@/lib/api-guard"
import { validarVigencia, parseFechaLocal } from "@/lib/vigencia"

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

    if (!esCancelacion) {
      const rango = parseVigenciaRango(String(nueva_vigencia).trim())
      if (!rango) {
        return NextResponse.json({ error: "Formato de vigencia inválido" }, { status: 400 })
      }
      const validacion = validarVigencia(rango.inicio, rango.fin)
      if (!validacion.ok) {
        return NextResponse.json({ error: validacion.error }, { status: 400 })
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

    const record = await prisma.catalogo_solicitud.create({
      data: {
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
    })

    broadcastUpdate(["catalogo"])

    return NextResponse.json({ record }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/solicitar]", e)
    return NextResponse.json({ error: "Error al crear solicitud de reutilización" }, { status: 500 })
  }
}
