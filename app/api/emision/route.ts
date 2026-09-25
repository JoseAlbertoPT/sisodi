import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion, verificarActor } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { checkSesionUsuario } from "@/lib/validar-sesion"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}

function generarFolioTemporal(id: number, fecha: Date | null | undefined): string {
  const f   = fecha ?? new Date()
  const mes = f.getMonth() + 1
  const ini = INICIALES_MES[mes] ?? "XX"
  const num = String(id).padStart(3, "0")
  return `${ini}-${num}-${f.getFullYear()}`
}

function resolverFolioDictamen(sol: any): string | null {
  return (
    sol.dictamen?.folio       ??
    sol.folio_dictamen        ??
    sol.folio_anterior        ??
    null
  )
}

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const vista = searchParams.get("vista")

    if (vista !== "emitidos") {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'vista' requerido. Use 'emitidos'" },
        { status: 400 }
      )
    }

    const userId = searchParams.get("userId")
    // El id que manda el cliente debe ser el de la sesión (lib/session.ts).
    const actorErr = verificarActor(sesion, userId)
    if (actorErr) return actorErr

    const estadoEmitido = await prisma.estado.findFirst({
      where: { nombre: { equals: "Emitido", mode: "insensitive" } },
    })

    if (!estadoEmitido) {
      return NextResponse.json({ ok: true, data: [] })
    }

    // Capturista y UEFA solo ven los dictámenes aprobados (Emitido) de su
    // propia secretaría. Administrador, Emisor, Verificador y Revisor ven todos.
    // Se compara por el nombre de la secretaría de nivel superior (antes del " > ")
    // porque el snapshot id/texto de cada solicitud varía según si se creó como
    // centralizada o paraestatal, pero la columna plana `secretaria` siempre trae
    // el nombre limpio. El usuario sale de la sesión (no del parámetro), para
    // que omitir `userId` no quite el filtro.
    const ROLES_SOLO_SU_SECRETARIA = ["capturista", "uefa"]
    let secretariaRestringida: string | null = null
    const viewer = await prisma.usuario.findUnique({
      where:  { id: userId ?? sesion.id },
      select: {
        secretaria_texto:    true,
        organo_centralizado: { select: { nombre: true } },
        rol:                 { select: { nombre: true } },
      },
    })
    if (viewer && ROLES_SOLO_SU_SECRETARIA.includes((viewer.rol?.nombre ?? "").trim().toLowerCase())) {
      secretariaRestringida = (viewer.secretaria_texto ?? viewer.organo_centralizado?.nombre ?? "")
        .split(">")[0]
        .trim()
        .toLowerCase()
      if (!secretariaRestringida) {
        return NextResponse.json({ ok: true, data: [] })
      }
    }

    const solicitudesTodas = await prisma.solicitud.findMany({
      where: { estado_id: estadoEmitido.id },
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true,
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            area:   { select: { id: true, nombre: true } },
            rol:    { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "asc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado:    true,
            estado_historial_solicitud_estado_anterior_idToestado: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha_emision: "desc" },
    })

    const solicitudes = secretariaRestringida
      ? solicitudesTodas.filter(
          (sol) => ((sol as any).secretaria ?? "").split(">")[0].trim().toLowerCase() === secretariaRestringida
        )
      : solicitudesTodas

    const data = solicitudes.map((sol) => {
      const historial = sol.historial_solicitud

      const emisorH = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("emitido")
      })

      let destinatarios: string[] = []
      if (emisorH?.comentario) {
        const match = emisorH.comentario.match(/Destinatarios:\s*(.+)/i)
        if (match) {
          destinatarios = match[1]
            .split("|")
            .map((d) => d.trim())
            .filter(Boolean)
        }
      }

      const fechaParaFolio = sol.fecha_envio ?? sol.fecha_creacion
      const folioRecepcion =
        sol.folio_recepcion ??
        generarFolioTemporal(
          sol.id,
          fechaParaFolio ? new Date(fechaParaFolio) : null
        )

      const folioDictamen = resolverFolioDictamen(sol) ?? "—"

      const secretaria =
        (sol as any).secretaria ??
        sol.usuario?.area?.nombre ??
        "—"

      return {
        id:             String(sol.id),
        folioDictamen,
        folioRecepcion,
        fechaEmision:
          sol.dictamen?.fecha_emision?.toISOString().slice(0, 10) ??
          (sol as any).fecha_emision?.toISOString().slice(0, 10) ??
          null,
        tipoFirma:      sol.dictamen?.tipo_firma ?? null,
        archivoPdf:     sol.dictamen?.archivo_pdf ?? null,
        secretaria,
        tipoSolicitud:  sol.tipo_solicitud ?? "—",
        regimen:        sol.regimen ?? null,
        denominacion:   (sol as any).denominacion || sol.tipo_solicitud || null,
        importeBruto:
          sol.importe_bruto != null
            ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`
            : null,
        vigenciaInicio:
          sol.vigencia_inicio?.toISOString().slice(0, 10) ?? null,
        vigenciaFin:
          sol.vigencia_fin?.toISOString().slice(0, 10) ?? null,
        esExtemporanea: (sol as any).es_extemporanea ?? null,
        estado:         sol.estado.nombre,
        periodo:
          sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        destinatarios,
        firmadoPor: {
          reviso: "Revisor",
          valido: "Validación Final",
          emitio: "Emisor",
        },
        tipoSolicitudRaw: sol.tipo_solicitud,
      }
    })

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error("[GET /api/emision]", error)
    return NextResponse.json(
      {
        ok:    false,
        error: mensajePublico(error, "Error al obtener dictámenes emitidos"),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const body = await req.json()
    const { solicitudId, tipoFirma, archivoPdf, destinatarios, usuarioId } = body

    if (!solicitudId || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, usuarioId" },
        { status: 400 }
      )
    }

    // Evita el error de FK historial_solicitud_usuario_id_fkey con sesión vieja.
    const sesionErr = await checkSesionUsuario(usuarioId)
    if (sesionErr) return sesionErr

    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json(
        { ok: false, error: "solicitudId debe ser un número válido" },
        { status: 400 }
      )
    }

    const dictamen = await prisma.dictamen.findUnique({
      where: { solicitud_id: idNum },
    })

    if (!dictamen) {
      return NextResponse.json(
        { ok: false, error: "Dictamen no encontrado para esta solicitud" },
        { status: 404 }
      )
    }

    const updated = await prisma.dictamen.update({
      where: { solicitud_id: idNum },
      data: {
        ...(tipoFirma  ? { tipo_firma:  tipoFirma }  : {}),
        ...(archivoPdf ? { archivo_pdf: archivoPdf } : {}),
      },
    })

    if (
      destinatarios &&
      Array.isArray(destinatarios) &&
      destinatarios.length > 0
    ) {
      const estadoEmitido = await prisma.estado.findFirst({
        where: { nombre: { equals: "Emitido", mode: "insensitive" } },
      })
      if (estadoEmitido) {
        await prisma.historial_solicitud.create({
          data: {
            solicitud_id:       idNum,
            usuario_id:         usuarioId,
            estado_anterior_id: estadoEmitido.id,
            estado_nuevo_id:    estadoEmitido.id,
            comentario: `Destinatarios: ${destinatarios.join(" | ")}`,
          },
        })
      }
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/emision]", error)
    return NextResponse.json(
      {
        ok:    false,
        error: mensajePublico(error, "Error al actualizar el dictamen"),
      },
      { status: 500 }
    )
  }
}