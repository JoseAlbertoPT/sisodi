import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { getEstadoId } from "@/lib/estado-cache"
import { getSecretariaScopeIds } from "@/lib/secretaria-scope"
import { checkSesionUsuario } from "@/lib/validar-sesion"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const ESTADOS_EXCLUIDOS_UEFA = ["En Captura", "Borrador"]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoNombre = searchParams.get("estado") ?? "En Captura"
    const usuarioId    = searchParams.get("usuarioId")
    const viewerUserId = searchParams.get("viewerId")

    let where: any = {}

    if (viewerUserId) {
      const viewer = await prisma.usuario.findUnique({
        where:  { id: viewerUserId },
        select: {
          secretaria_id:       true,
          secretaria_texto:    true,
          organo_centralizado: { select: { id: true } },
        },
      })
      if (viewer) {
        // Cada usuario solo ve solicitudes de su propio ámbito: un usuario con
        // órgano centralizado ve lo centralizado (incluye registros sin tipo,
        // tratados como centralizada); uno paraestatal solo ve lo paraestatal.
        // NOTA: `{ not: "paraestatal" }` excluye los NULL en SQL, por eso el OR
        // explícito con null para no perder registros sin tipo definido.
        if (viewer.organo_centralizado) {
          where.OR = [
            { tipo_administracion: { not: "paraestatal" } },
            { tipo_administracion: null },
          ]
        } else {
          where.tipo_administracion = "paraestatal"
        }

        if (viewer.secretaria_id) {
          // Alcance a nivel Secretaría: todos los nodos (Direcciones, etc.) de la
          // misma Secretaría, no solo el nodo exacto del usuario.
          const scopeIds = await getSecretariaScopeIds(viewer.secretaria_id)
          where.secretaria_id_snapshot = { in: scopeIds }
        } else if (viewer.secretaria_texto) {
          where.secretaria_txt_snapshot = viewer.secretaria_texto
        } else {
          return NextResponse.json({ ok: true, data: [] })
        }
      }
    }

    if (estadoNombre !== "todos") {
      const estado = await prisma.estado.findFirst({
        where: { nombre: { equals: estadoNombre, mode: "insensitive" } },
      })
      if (!estado) return NextResponse.json({ ok: true, data: [] })
      where.estado_id = estado.id
    } else {
      const estadosExcluidos = await prisma.estado.findMany({
        where: { nombre: { in: ESTADOS_EXCLUIDOS_UEFA, mode: "insensitive" } },
        select: { id: true },
      })
      if (estadosExcluidos.length > 0) {
        where.NOT = { estado_id: { in: estadosExcluidos.map((e) => e.id) } }
      }
    }

    if (usuarioId) where.usuario_id = usuarioId

    const solicitudes = await prisma.solicitud.findMany({
      where,
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true,
        usuario: {
          select: {
            id:           true,
            nombre:       true,
            correo:       true,
            rfc:          true,
            secretaria_id: true,
            area:         { select: { id: true, nombre: true } },
            rol:          { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "asc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado:    true,
            estado_historial_solicitud_estado_anterior_idToestado: true,
            usuario: { select: { id: true, nombre: true, correo: true } },
          },
        },
        adjunto: true,
      },
      orderBy: { fecha_creacion: "desc" },
    })

    const sorted = [...solicitudes].sort((a, b) => {
      const ta = (a.fecha_envio ?? a.fecha_creacion ?? new Date(0)).getTime()
      const tb = (b.fecha_envio ?? b.fecha_creacion ?? new Date(0)).getTime()
      return tb - ta
    })

    const enriched = sorted.map((sol) => {
      const folioDictamen =
        (sol as any).folio_dictamen ??
        sol.dictamen?.folio         ??
        (sol as any).folio_anterior ??
        null

      return {
        ...sol,
        folioDictamen,
        _raw: { ...sol, folioDictamen },
      }
    })

    return NextResponse.json({ ok: true, data: enriched })
  } catch (error: any) {
    console.error("[GET /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes para validación" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, nuevoEstado, usuarioId, comentario, revisorId } = body

    if (!solicitudId || !nuevoEstado || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: solicitudId, nuevoEstado, usuarioId" },
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

    const [solicitud, estadoNuevoId] = await Promise.all([
      prisma.solicitud.findUnique({
        where:   { id: idNum },
        include: { estado: true, usuario: { select: { secretaria_id: true, secretaria_texto: true, area_id: true } } },
      }),
      getEstadoId(nuevoEstado, { crearSiNoExiste: { descripcion: `Estado: ${nuevoEstado}` } }),
    ])

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    const esEnvioAValidacion =
      nuevoEstado.toLowerCase().includes("en validacion justificaciones") ||
      nuevoEstado.toLowerCase().includes("enviada a validacion")

    // Regla 11: el folio de recepción NO se asigna aquí. UEFA solo manda la
    // solicitud a DGDO ("Pendiente DO") — el folio de recepción se asigna
    // hasta que el Revisor (filtro 1) la aprueba y la envía a Verificación
    // (ver app/api/filtro/route.ts, accion "aprobar" con filtro === 1).


    let folioJustificacionNuevo: string | undefined
    if (esEnvioAValidacion && !solicitud.folio_justificacion) {
      const year = new Date().getFullYear()
      // Folio de justificación GLOBAL (contador único para todo el sistema).
      // El "tipo" del consecutivo se queda como "JUST-GLOBAL" aunque el
      // prefijo visible del folio sea "ID-", para no reiniciar el contador.
      const tipoFolio = "JUST-GLOBAL"
      const registro = await prisma.consecutivo_folio.upsert({
        where:  { tipo_mes_anio: { tipo: tipoFolio, mes: 0, anio: year } },
        update: { consecutivo: { increment: 1 } },
        create: { tipo: tipoFolio, mes: 0, anio: year, consecutivo: 1 },
      })
      folioJustificacionNuevo = `ID-${year}-${String(registro.consecutivo ?? 1).padStart(4, "0")}`
    }

    const [solicitudActualizada] = await Promise.all([
      prisma.solicitud.update({
        where:   { id: idNum },
        data:    {
          estado_id: estadoNuevoId!,
          ...(esEnvioAValidacion && { fecha_envio: new Date() }),
          ...(folioJustificacionNuevo && { folio_justificacion: folioJustificacionNuevo }),
          ...(revisorId && { revisor_asignado_id: revisorId }),
        },
        include: { estado: true, periodo: true },
      }),
      prisma.historial_solicitud.create({
        data: {
          solicitud_id:       idNum,
          usuario_id:         usuarioId,
          estado_anterior_id: solicitud.estado_id,
          estado_nuevo_id:    estadoNuevoId!,
          comentario:         comentario ?? null,
        },
      }),
    ])

    console.log(`[validacion PATCH] solicitud=${idNum} estado_anterior="${solicitud.estado.nombre}" → estado_nuevo="${nuevoEstado}"`)
    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok:    true,
      data:  solicitudActualizada,
      folio: folioJustificacionNuevo ?? solicitudActualizada.folio_justificacion ?? null,
    })
  } catch (error: any) {
    console.error("[PATCH /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al actualizar el estado" },
      { status: 500 }
    )
  }
}