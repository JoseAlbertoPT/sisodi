import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

// Límite máximo al reutilizar un registro: Seguridad Pública permite hasta
// 100 prestadores; el resto de las secretarías, hasta 50.
function maxPrestadoresPermitido(secretaria: string | null | undefined): number {
  const s = (secretaria ?? "").toLowerCase()
  return s.includes("seguridad p") ? 100 : 50
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      catalogo_justificacion_id,
      usuario_id,
      nueva_vigencia,
      nuevo_numero_personas,
      nuevos_numero_prestadores,
      tipo,
      programa_anterior,
      nuevo_programa_proyecto,
    } = body

    if (!catalogo_justificacion_id || !usuario_id || !nueva_vigencia?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    // La cancelación no captura número de prestadores/personas, solo vigencia.
    // "programa" solo captura el cambio de Programa/Proyecto; la vigencia se
    // manda igual a la actual (no cambia), solo para satisfacer el campo requerido.
    const tipoNormalizado = tipo === "cancelacion" ? "cancelacion" : tipo === "programa" ? "programa" : "reutilizacion"
    const esCancelacion = tipoNormalizado === "cancelacion"
    const esPrograma = tipoNormalizado === "programa"

    if (esPrograma && !nuevo_programa_proyecto?.trim()) {
      return NextResponse.json({ error: "Falta el nuevo Programa o Proyecto" }, { status: 400 })
    }

    const catalogo = await prisma.catalogo_justificacion.findUnique({
      where: { id: Number(catalogo_justificacion_id) },
    })
    if (!catalogo) {
      return NextResponse.json({ error: "Registro de catálogo no encontrado" }, { status: 404 })
    }

    if (!esCancelacion && !esPrograma && nuevos_numero_prestadores) {
      const maxPrestadores = maxPrestadoresPermitido(catalogo.secretaria_txt_snapshot ?? catalogo.secretaria)
      if (Number(nuevos_numero_prestadores) > maxPrestadores) {
        return NextResponse.json(
          { error: `El número de prestadores no puede exceder ${maxPrestadores} para esta secretaría` },
          { status: 400 },
        )
      }
    }

    const record = await prisma.catalogo_solicitud.create({
      data: {
        catalogo_justificacion_id: Number(catalogo_justificacion_id),
        usuario_id: String(usuario_id),
        nueva_vigencia: String(nueva_vigencia).trim(),
        nuevo_numero_personas: esCancelacion || esPrograma || !nuevo_numero_personas ? null : Number(nuevo_numero_personas),
        nuevos_numero_prestadores: esCancelacion || esPrograma || !nuevos_numero_prestadores ? null : Number(nuevos_numero_prestadores),
        tipo: tipoNormalizado,
        programa_anterior: esPrograma ? String(programa_anterior ?? "").trim() || null : null,
        nuevo_programa_proyecto: esPrograma ? String(nuevo_programa_proyecto).trim() : null,
      },
    })

    broadcastUpdate(["catalogo"])

    return NextResponse.json({ record }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/solicitar]", e)
    return NextResponse.json({ error: "Error al crear solicitud de reutilización" }, { status: 500 })
  }
}
