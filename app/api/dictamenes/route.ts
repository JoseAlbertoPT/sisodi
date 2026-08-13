import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { checkSesionUsuario } from "@/lib/validar-sesion"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

async function generarFolioDictamen(tipo: "dictamen" | "opinion"): Promise<string> {
  const ahora = new Date()
  const mes   = ahora.getMonth() + 1
  const anio  = ahora.getFullYear()
  const clave = tipo === "dictamen" ? "DICT" : "OPI"

  const registro = await prisma.consecutivo_folio.upsert({
    where:  { tipo_mes_anio: { tipo: clave, mes, anio } },
    update: { consecutivo: { increment: 1 } },
    create: { tipo: clave, mes, anio, consecutivo: 1 },
  })

  const num     = String(registro.consecutivo ?? 1).padStart(3, "0")
  const mesPad  = String(mes).padStart(2, "0")
  return `${num}/${mesPad}/${anio}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const vista = searchParams.get("vista") ?? "pendientes"
    if (vista === "emitidos") {
      const dictamenes = await prisma.dictamen.findMany({
        include: {
          solicitud: {
            include: {
              estado:  true,
              periodo: true,
              usuario: {
                select: {
                  id:     true,
                  nombre: true,
                  correo: true,
                  rfc:    true,
                  area:   { select: { id: true, nombre: true } },
                  rol:    { select: { id: true, nombre: true } },
                },
              },
            },
          },
        },
        orderBy: { fecha_emision: "desc" },
      })
      const solicitudIds = dictamenes.map((d) => d.solicitud_id)

      const historiales =
        solicitudIds.length > 0
          ? await prisma.historial_solicitud.findMany({
              where:   { solicitud_id: { in: solicitudIds } },
              orderBy: { fecha: "desc" },
              include: {
                estado_historial_solicitud_estado_nuevo_idToestado: true,
                usuario: { select: { id: true, nombre: true } },
              },
            })
          : []

      const historialMap: Record<number, typeof historiales> = {}
      for (const h of historiales) {
        if (!historialMap[h.solicitud_id]) historialMap[h.solicitud_id] = []
        historialMap[h.solicitud_id].push(h)
      }

      const data = dictamenes.map((d) => {
        const sol      = d.solicitud
        const historial = historialMap[sol.id] ?? []
        const hEmision = historial.find(
          (h) =>
            h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre === "Emitido"
        )
        const comentario = hEmision?.comentario ?? ""
        const destinatarios: string[] = []
        const mDest = comentario.match(/Destinatarios:\s*([^|]+)/)
        if (mDest) {
          mDest[1].split(",").forEach((t: string) => {
            const s = t.trim()
            if (s) destinatarios.push(s)
          })
        }
        const firmadoPor = {
          reviso: "Revisor",
          valido: "Validación Final",
          emitio: "Emisor",
        }

        return {
          id:             String(sol.id),
          folioDictamen:  d.folio,
          folioRecepcion: sol.folio_recepcion,
          fechaEmision:   d.fecha_emision?.toISOString().slice(0, 10) ?? null,
          tipoFirma:      d.tipo_firma,
          archivoPdf:     d.archivo_pdf,
          secretaria:     sol.usuario?.area?.nombre ?? "—",
          tipoSolicitud:      sol.tipo_solicitud,
          tipoAdministracion: sol.tipo_administracion ?? "centralizada",
          denominacion:       sol.denominacion,
          importeBruto:       sol.importe_bruto?.toString() ?? null,
          vigenciaInicio:     sol.vigencia_inicio?.toISOString().slice(0, 10) ?? null,
          vigenciaFin:        sol.vigencia_fin?.toISOString().slice(0, 10)    ?? null,
          esExtemporanea:     sol.es_extemporanea,
          estado:             sol.estado.nombre,
          periodo:            sol.periodo
            ? `${sol.periodo.mes}/${sol.periodo.anio}`
            : null,
          destinatarios,
          firmadoPor,
        }
      })

      return NextResponse.json({ ok: true, data })
    }
    const estadoAprobado = await prisma.estado.findFirst({
      where: { nombre: "Aprobado" },
    })

    if (!estadoAprobado) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const solicitudes = await prisma.solicitud.findMany({
      where: {
        estado_id: estadoAprobado.id,
        dictamen:  null,
      },
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true,
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            rfc:    true,
            area:   { select: { id: true, nombre: true } },
            rol:    { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "desc" },
          take:    5,
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha_envio: "asc" },
    })

    const data = solicitudes.map((sol) => ({
      id:             String(sol.id),
      folioRecepcion: sol.folio_recepcion,
      folioDictamen:  sol.folio_dictamen,
      tipo:               sol.tipo_solicitud,
      tipoAdministracion: sol.tipo_administracion ?? "centralizada",
      secretaria:         sol.usuario?.area?.nombre ?? "—",
      denominacion:   sol.denominacion,
      importeBruto:   sol.importe_bruto?.toString() ?? null,
      vigenciaInicio: sol.vigencia_inicio?.toISOString().slice(0, 10) ?? null,
      vigenciaFin:    sol.vigencia_fin?.toISOString().slice(0, 10)    ?? null,
      esExtemporanea: sol.es_extemporanea,
      estado:         sol.estado.nombre,
      periodo:        sol.periodo
        ? `${sol.periodo.mes}/${sol.periodo.anio}`
        : null,
      fechaEnvio: sol.fecha_envio?.toISOString().slice(0, 10) ?? null,
      historial:  sol.historial_solicitud.map((h) => ({
        fecha:   h.fecha ? new Date(h.fecha).toLocaleString("es-MX") : "—",
        usuario: h.usuario?.nombre ?? "Sistema",
        estado:  h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
      })),
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error("[GET /api/emision]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes para emisión" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      solicitudId,
      usuarioId,
      tipoFirma     = "autografa",
      destinatarios = [],
      firmadoPor    = null,
      archivoPdf    = null,
    } = body

    if (!solicitudId || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, usuarioId" },
        { status: 400 }
      )
    }

    // Evita el error de FK historial_solicitud_usuario_id_fkey con sesión vieja.
    const sesionErr = await checkSesionUsuario(usuarioId)
    if (sesionErr) return sesionErr

    const solicitud = await prisma.solicitud.findUnique({
      where:   { id: Number(solicitudId) },
      include: { estado: true, dictamen: true },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    if (solicitud.dictamen) {
      return NextResponse.json(
        { ok: false, error: "Esta solicitud ya tiene un dictamen emitido" },
        { status: 409 }
      )
    }

    if (!solicitud.estado.nombre.toLowerCase().includes("aprobado")) {
      return NextResponse.json(
        { ok: false, error: `Estado actual no permite emisión: ${solicitud.estado.nombre}` },
        { status: 422 }
      )
    }

    const esParaestatal =
      (solicitud.tipo_solicitud ?? "").toLowerCase().includes("paraestatal")
    const tipoDoc: "dictamen" | "opinion" = esParaestatal ? "opinion" : "dictamen"
    const folio = await generarFolioDictamen(tipoDoc)

    let estadoEmitido = await prisma.estado.findFirst({ where: { nombre: "Emitido" } })
    if (!estadoEmitido) {
      estadoEmitido = await prisma.estado.create({
        data: {
          nombre:      "Emitido",
          descripcion: "Dictamen/Opinión emitido por la Dirección de Organización",
        },
      })
    }

    const ahora = new Date()

    const partes: string[] = [
      `Dictamen emitido. Folio: ${folio}`,
      `Tipo firma: ${tipoFirma}`,
    ]
    if ((destinatarios as string[]).length > 0) {
      partes.push(`Destinatarios: ${(destinatarios as string[]).join(", ")}`)
    }
    if (firmadoPor) {
      partes.push(
        `Revisó: ${firmadoPor.reviso} | Validó: ${firmadoPor.valido} | Emitió: ${firmadoPor.emitio}`
      )
    }

    const [dictamen] = await prisma.$transaction([
      prisma.dictamen.create({
        data: {
          solicitud_id:  Number(solicitudId),
          folio,
          fecha_emision: ahora,
          tipo_firma:    tipoFirma,
          archivo_pdf:   archivoPdf ?? null,
        },
      }),
      prisma.solicitud.update({
        where: { id: Number(solicitudId) },
        data: {
          estado_id:      estadoEmitido.id,
          folio_dictamen: folio,
          fecha_emision:  ahora,
        },
      }),
      prisma.historial_solicitud.create({
        data: {
          solicitud_id:       Number(solicitudId),
          usuario_id:         usuarioId,
          estado_anterior_id: solicitud.estado_id,
          estado_nuevo_id:    estadoEmitido.id,
          comentario:         partes.join(" | "),
        },
      }),
    ])

    broadcastUpdate(ALL_APARTADOS)

    // Auto-crear registro en catálogo de justificaciones (best-effort)
    try {
      const existing = await prisma.catalogo_justificacion.findUnique({
        where: { solicitud_id: Number(solicitudId) },
      })
      if (!existing) {
        const vigencia =
          solicitud.vigencia_inicio && solicitud.vigencia_fin
            ? `${solicitud.vigencia_inicio.toISOString().slice(0, 10)} / ${solicitud.vigencia_fin.toISOString().slice(0, 10)}`
            : null
        await prisma.catalogo_justificacion.create({
          data: {
            solicitud_id:             Number(solicitudId),
            regimen_contratacion:     solicitud.regimen ?? "honorarios",
            programa_proyecto:        solicitud.programa_proyecto ?? "",
            tipo_actividad:           solicitud.tipo_actividades ?? null,
            denominacion_nombramiento: solicitud.denominacion ?? null,
            puesto_jefe_inmediato:    solicitud.puesto_jefe_inmediato ?? null,
            numero_personas:          solicitud.numero_prestadores ?? null,
            tipo_pago:                solicitud.tipo_importe ?? null,
            importe_bruto:            solicitud.importe_bruto ?? null,
            importe_neto:             null,
            vigencia,
            activo:                   true,
            tipo_solicitud:           solicitud.tipo_solicitud ?? null,
            secretaria:               (solicitud as any).secretaria ?? null,
            secretaria_txt_snapshot:  (solicitud as any).secretaria_txt_snapshot ?? null,
            folio_recepcion:          solicitud.folio_recepcion ?? null,
            folio_dictamen:           (solicitud as any).folio_dictamen ?? null,
          },
        })
      }
    } catch (catalogError) {
      console.error("[POST /api/dictamenes] Error al crear catálogo:", catalogError)
    }

    return NextResponse.json({
      ok:           true,
      folio,
      dictamenId:   dictamen.id,
      fechaEmision: ahora.toISOString().slice(0, 10),
      estadoNuevo:  "Emitido",
    })
  } catch (error: any) {
    console.error("[POST /api/emision]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al emitir el dictamen" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, archivoPdf } = body

    if (!solicitudId || !archivoPdf) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: solicitudId, archivoPdf" },
        { status: 400 }
      )
    }

    const dictamen = await prisma.dictamen.findUnique({
      where: { solicitud_id: Number(solicitudId) },
    })

    if (!dictamen) {
      return NextResponse.json(
        { ok: false, error: "No existe dictamen para esta solicitud" },
        { status: 404 }
      )
    }

    const actualizado = await prisma.dictamen.update({
      where: { solicitud_id: Number(solicitudId) },
      data:  { archivo_pdf: archivoPdf },
    })

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, data: actualizado })
  } catch (error: any) {
    console.error("[PATCH /api/emision]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al actualizar PDF" },
      { status: 500 }
    )
  }
}