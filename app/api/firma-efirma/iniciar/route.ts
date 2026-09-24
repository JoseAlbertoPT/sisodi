import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { firmaPdfDisponible, guardarFirmaPdf } from "@/lib/firma-pdf-storage"
import { plantillaFirmantes, resolverUsuariosInternos, usuarioIdParaFirmante } from "@/lib/firma-plantillas"

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const body = await req.json()
    const { solicitudId, archivo, creadoPorId } = body

    if (!solicitudId || !archivo || !creadoPorId) {
      return NextResponse.json({ ok: false, error: "Faltan campos requeridos (solicitudId, archivo, creadoPorId)" }, { status: 400 })
    }

    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }

    const solicitud = await prisma.solicitud.findUnique({ where: { id: idNum } })
    if (!solicitud) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 })
    }

    const base64 = String(archivo).replace(/^data:application\/pdf;base64,/, "")

    const existente = await prisma.firma_proceso.findUnique({ where: { solicitud_id: idNum } })
    if (existente && existente.estado !== "cancelado") {
      // Procesos iniciados antes del cambio a S3 no tienen su PDF aquí y no hay
      // forma de cancelarlos desde la app. Si nadie ha firmado todavía, se vuelve
      // a subir el PDF con la misma key: uuid y tokens se conservan, así que el
      // link ya enviado al firmante externo empieza a funcionar sin reenviarlo.
      const reparable =
        existente.uuid && existente.firmados === 0 && existente.estado !== "completado"
        && !(await firmaPdfDisponible(existente.uuid))
      if (!reparable) {
        return NextResponse.json({ ok: false, error: "Ya existe un proceso de firma para esta solicitud" }, { status: 409 })
      }
      try {
        await guardarFirmaPdf(existente.uuid!, Buffer.from(base64, "base64"))
      } catch (e) {
        console.error("[firma-efirma/iniciar] error volviendo a guardar el PDF", e)
        return NextResponse.json({ ok: false, error: "No se pudo guardar el PDF a firmar" }, { status: 500 })
      }
      const firmantes = await prisma.firma_firmante.findMany({
        where: { firma_proceso_id: existente.id },
        orderBy: { orden: "asc" },
        include: { usuario: { select: { id: true, nombre: true, rfc: true, correo: true } } },
      })
      return NextResponse.json({
        ok: true,
        reparado: true,
        proceso: {
          id: existente.id,
          uuid: existente.uuid,
          total_firmantes: existente.total_firmantes,
          firmados: existente.firmados,
          estado: existente.estado,
        },
        firmantes,
      })
    }

    const plantilla = plantillaFirmantes(solicitud.tipo_solicitud)
    const totalFirmantes = plantilla.length

    // No hay portal externo manejando "procesos" de firma (WSFirmaOficio firma
    // un documento por llamada, sin sesión multi-firmante propia) — procesoId
    // y storageKey son puramente internos, igual en bypass que en real. El PDF
    // se guarda una sola vez aquí (en disco en bypass, en S3 en real) para que
    // cada firmante posterior (/firmar, /firmar-interno) lo use como contenido
    // a sellar y para que el firmante externo pueda previsualizarlo antes de firmar.
    const procesoId  = `${idNum}-${Date.now()}`
    const storageKey = randomBytes(16).toString("hex")
    try {
      await guardarFirmaPdf(storageKey, Buffer.from(base64, "base64"))
    } catch (e) {
      console.error("[firma-efirma/iniciar] error guardando PDF a firmar", e)
      return NextResponse.json(
        { ok: false, error: "No se pudo guardar el PDF a firmar" },
        { status: 500 },
      )
    }

    const internos = await resolverUsuariosInternos(idNum)

    const result = await prisma.$transaction(async tx => {
      const proceso = await tx.firma_proceso.create({
        data: {
          solicitud_id: idNum,
          tipo: "electronica",
          proceso_id: String(procesoId),
          uuid: String(storageKey),
          total_firmantes: totalFirmantes,
          firmados: 0,
          estado: "iniciado",
          creado_por_id: creadoPorId,
        },
      })

      const firmanteRows = plantilla.map(tpl => {
        const usuarioId = usuarioIdParaFirmante(tpl, creadoPorId, internos)
        return {
          firma_proceso_id: proceso.id,
          orden:  tpl.orden,
          rol:    tpl.rol,
          cargo:  tpl.cargo,
          tipo:   tpl.tipo,
          bandeja: tpl.bandeja ?? null,
          usuario_id: usuarioId,
          firmado: false,
          acceso_token: tpl.tipo === "externo" ? randomBytes(32).toString("hex") : null,
        }
      })

      await tx.firma_firmante.createMany({ data: firmanteRows })

      const firmantes = await tx.firma_firmante.findMany({
        where: { firma_proceso_id: proceso.id },
        orderBy: { orden: "asc" },
        include: {
          usuario: { select: { id: true, nombre: true, rfc: true, correo: true } },
        },
      })

      return { proceso, firmantes }
    })

    return NextResponse.json({
      ok: true,
      proceso: {
        id: result.proceso.id,
        uuid: result.proceso.uuid,
        total_firmantes: result.proceso.total_firmantes,
        firmados: result.proceso.firmados,
        estado: result.proceso.estado,
      },
      firmantes: result.firmantes,
    })
  } catch (err: any) {
    console.error("[firma-efirma/iniciar]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
