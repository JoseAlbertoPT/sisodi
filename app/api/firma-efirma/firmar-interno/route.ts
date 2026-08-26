import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { efirmaClient, firmadosCount, normalizarEstado } from "@/lib/efirma-client"
import { broadcastUpdate } from "@/lib/sse-manager"
import { checkSesionUsuario } from "@/lib/validar-sesion"
import { ESTADO_POR_BANDEJA_PENDIENTE } from "@/lib/firma-plantillas"
import { puedeFirmarVerificacion } from "@/lib/api-guard"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const norm = (s: string) => s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().trim()

const BYPASS = process.env.EFIRMA_BYPASS === "true"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firmanteId, usuarioId, cargoFirmante, certificado, clavePrivada, fraseClavePrivada, skipEmit } = body

    if (!firmanteId || !usuarioId || !cargoFirmante) {
      return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 })
    }

    // Evita el error de FK historial_solicitud_usuario_id_fkey con sesión vieja.
    const sesionErr = await checkSesionUsuario(usuarioId)
    if (sesionErr) return sesionErr
    if (!BYPASS && (!certificado || !clavePrivada || !fraseClavePrivada)) {
      return NextResponse.json({ ok: false, error: "Faltan credenciales de e.firma" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { id: Number(firmanteId) },
      include: {
        firma_proceso: { include: { firmantes: true } },
        usuario: true,
      },
    })
    if (!firmante)                          return NextResponse.json({ ok: false, error: "Firmante no encontrado" }, { status: 404 })
    if (firmante.tipo !== "interno")        return NextResponse.json({ ok: false, error: "Este firmante no es interno" }, { status: 400 })

    // Los bloques UEFA y Validación no están atados a quien aprobó, sino a
    // cualquier usuario con el rol correspondiente: se verifica el rol en vez
    // de confiar en el usuario_id de la solicitud, que el cliente podría
    // falsear. Por eso ignoran el candado de "usuario_id asignado" de abajo,
    // sin importar si ese campo quedó null o con un usuario_id específico.
    const bandejaLibrePorRol = firmante.bandeja === "uefa" || firmante.bandeja === "validacion"
    const slotSinAsignar = !firmante.usuario_id
    if (!BYPASS && !bandejaLibrePorRol && !slotSinAsignar && firmante.usuario_id !== usuarioId) {
      return NextResponse.json({ ok: false, error: "No te corresponde firmar este bloque" }, { status: 403 })
    }
    if (!BYPASS && bandejaLibrePorRol) {
      const solicitante = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        include: { rol: true },
      })
      const rolSolicitante = norm(solicitante?.rol.nombre ?? "")
      const rolesPermitidos = firmante.bandeja === "uefa" ? ["uefa", "administrador"] : ["verificador", "administrador"]
      if (!solicitante || !rolesPermitidos.includes(rolSolicitante)) {
        const rolEsperado = firmante.bandeja === "uefa" ? "UEFA" : "Verificador"
        return NextResponse.json({ ok: false, error: `Solo un usuario con rol ${rolEsperado} puede firmar este bloque` }, { status: 403 })
      }
      // Permiso puntual "Firma" en Permisos de menús > Verificación — permite
      // dejar a un usuario con acceso de solo lectura a la bandeja, sin
      // capacidad de firmar (ver lib/api-guard.ts:puedeFirmarVerificacion).
      if (firmante.bandeja === "validacion" && !(await puedeFirmarVerificacion(usuarioId))) {
        return NextResponse.json({ ok: false, error: "No tienes permiso para firmar en Verificación" }, { status: 403 })
      }
    }
    if (firmante.firmado)                   return NextResponse.json({ ok: false, error: "Ya firmaste" }, { status: 409 })
    if (firmante.firma_proceso.estado === "completado") {
      return NextResponse.json({ ok: false, error: "El proceso ya está completado" }, { status: 409 })
    }
    if (!firmante.firma_proceso.proceso_id) {
      return NextResponse.json({ ok: false, error: "Proceso sin identificador del portal" }, { status: 500 })
    }

    // Un externo firmado pero aún no verificado por el primer revisor interno
    // (UEFA) cuenta como "no listo" para efectos de avanzar el turno — igual
    // que si no hubiera firmado (ver /api/firma-efirma/verificar/:id).
    const noListo = (f: { tipo: string; firmado: boolean; verificado: boolean }) =>
      !f.firmado || (f.tipo === "externo" && !f.verificado)

    // Revisor (Filtro 1) no depende de que UEFA haya firmado: su revisión
    // corre en paralelo, solo espera a que los externos (Elaboró) firmen y
    // queden verificados.
    const anterioresPendientes = firmante.bandeja === "revision"
      ? firmante.firma_proceso.firmantes.filter(f => f.tipo === "externo" && noListo(f))
      : firmante.firma_proceso.firmantes.filter(f => f.orden < firmante.orden && noListo(f))
    if (anterioresPendientes.length > 0) {
      const siguiente = anterioresPendientes.sort((a, b) => a.orden - b.orden)[0]
      const razon = !siguiente.firmado
        ? `Primero debe firmar #${siguiente.orden} (${siguiente.rol}).`
        : `Falta verificar la firma de #${siguiente.orden} (${siguiente.rol}).`
      return NextResponse.json({ ok: false, error: `Aún no es tu turno. ${razon}` }, { status: 412 })
    }

    // Si el bloque es de rol libre (UEFA/Validación), el firmante real es
    // quien está autenticado ahora, sin importar a quién quedó asignado el
    // usuario_id originalmente (puede ser otro miembro del mismo rol).
    const usuarioEfectivo = (slotSinAsignar || bandejaLibrePorRol)
      ? await prisma.usuario.findUnique({ where: { id: usuarioId } })
      : firmante.usuario
    const rfcUsuario = usuarioEfectivo?.rfc
    if (!rfcUsuario) {
      return NextResponse.json({ ok: false, error: "Tu usuario no tiene RFC registrado. Contacta al administrador." }, { status: 400 })
    }

    const portalRes = BYPASS
      ? { firma: { responsable: usuarioEfectivo?.nombre ?? null }, estado: "iniciado", bypass: true }
      : await efirmaClient.firmar({
          procesoId: firmante.firma_proceso.proceso_id,
          usuario: rfcUsuario.toUpperCase(),
          certificado,
          clavePrivada,
          fraseClavePrivada,
        })

    const estadoPortal = normalizarEstado(portalRes, "iniciado")
    const ahora = new Date()

    const result = await prisma.$transaction(async tx => {
      await tx.firma_firmante.update({
        where: { id: firmante.id },
        data: {
          firmado: true,
          fecha_firma: ahora,
          rfc: rfcUsuario.toUpperCase(),
          nombre: usuarioEfectivo?.nombre ?? portalRes?.firma?.responsable ?? null,
          cargo_firmante: String(cargoFirmante).trim(),
          ...(slotSinAsignar || bandejaLibrePorRol ? { usuario_id: usuarioId } : {}),
        },
      })
      const firmadosLocal = await tx.firma_firmante.count({
        where: { firma_proceso_id: firmante.firma_proceso_id, firmado: true },
      })
      const completo = firmadosLocal >= (firmante.firma_proceso.total_firmantes ?? 0)
      await tx.firma_proceso.update({
        where: { id: firmante.firma_proceso_id },
        data: {
          firmados: firmadosLocal,
          estado: completo ? "completado" : estadoPortal,
          fecha_completado: completo ? ahora : null,
        },
      })
      return { firmadosLocal, completo }
    })

    if (!result.completo) {
      // El siguiente estado depende de cuál es el firmante interno de MENOR
      // orden que todavía falta por firmar — no de cuál bandeja acaba de
      // firmar. Revisor puede firmar antes que UEFA (no se esperan entre
      // sí), así que si UEFA sigue pendiente, el estado no debe saltarse su
      // turno aunque Revisor ya haya firmado.
      const siguientePendiente = firmante.firma_proceso.firmantes
        .filter(f => f.tipo === "interno" && f.id !== firmante.id && !f.firmado)
        .sort((a, b) => a.orden - b.orden)[0]
      const siguienteEstado = siguientePendiente
        ? ESTADO_POR_BANDEJA_PENDIENTE[(siguientePendiente.bandeja ?? "") as keyof typeof ESTADO_POR_BANDEJA_PENDIENTE]
        : null
      if (siguienteEstado) {
        const estadoSig = await prisma.estado.findFirst({
          where: { nombre: { equals: siguienteEstado, mode: "insensitive" } },
        })
        if (!estadoSig) {
          return NextResponse.json(
            { ok: false, error: `Estado "${siguienteEstado}" no existe en BD. Corre el seed de estados.` },
            { status: 500 },
          )
        }
        const solicitudActual = await prisma.solicitud.findUnique({
          where: { id: firmante.firma_proceso.solicitud_id },
          select: { estado_id: true },
        })
        await prisma.$transaction([
          prisma.solicitud.update({
            where: { id: firmante.firma_proceso.solicitud_id },
            data: { estado_id: estadoSig.id },
          }),
          prisma.historial_solicitud.create({
            data: {
              solicitud_id: firmante.firma_proceso.solicitud_id,
              usuario_id: usuarioId,
              estado_anterior_id: solicitudActual?.estado_id ?? null,
              estado_nuevo_id: estadoSig.id,
              comentario: `Firma completada en bandeja ${firmante.bandeja}. Avanza a ${siguienteEstado}.`,
            },
          }),
        ])
      }
    }

    let emisionHecha = false
    let folioDictamenFinal: string | null = null
    if (result.completo && firmante.bandeja === "emision" && !skipEmit) {
      try {
        const solicitudId = firmante.firma_proceso.solicitud_id
        const solicitud = await prisma.solicitud.findUnique({
          where: { id: solicitudId },
          include: { dictamen: true },
        })
        if (solicitud) {
          const modalidad = (solicitud as any).modalidad_firma ?? "electronica"
          const folioJust = (solicitud as any).folio_justificacion ?? null
          folioDictamenFinal = (solicitud as any).folio_dictamen ?? solicitud.dictamen?.folio ?? folioJust

          const estadoEmitido = await prisma.estado.findFirst({
            where: { nombre: { equals: "Emitido", mode: "insensitive" } },
          })
          if (!estadoEmitido) {
            return NextResponse.json(
              { ok: false, error: 'Estado "Emitido" no existe en BD. Corre el seed de estados.' },
              { status: 500 },
            )
          }

          const ops: any[] = [
            prisma.solicitud.update({
              where: { id: solicitudId },
              data: { estado_id: estadoEmitido.id, fecha_emision: ahora, ...(folioDictamenFinal ? { folio_dictamen: folioDictamenFinal } : {}) } as any,
            }),
            prisma.historial_solicitud.create({
              data: {
                solicitud_id: solicitudId,
                usuario_id: usuarioId,
                estado_anterior_id: solicitud.estado_id,
                estado_nuevo_id: estadoEmitido.id,
                comentario: `Dictamen emitido tras firma completa. Modalidad: ${modalidad}${folioDictamenFinal ? ` | Folio: ${folioDictamenFinal}` : ""}`,
              },
            }),
          ]
          if (!solicitud.dictamen && folioDictamenFinal) {
            ops.unshift(
              prisma.dictamen.create({
                data: {
                  solicitud_id: solicitudId,
                  folio: folioDictamenFinal,
                  fecha_emision: ahora,
                  tipo_firma: modalidad,
                  archivo_pdf: null,
                },
              })
            )
          } else if (solicitud.dictamen) {
            ops.push(
              prisma.dictamen.update({
                where: { solicitud_id: solicitudId },
                data: { tipo_firma: modalidad, fecha_emision: ahora },
              })
            )
          }
          await prisma.$transaction(ops)
          emisionHecha = true

          // Auto-crear registro en catálogo de justificaciones (best-effort)
          try {
            const existingCatalogo = await prisma.catalogo_justificacion.findUnique({
              where: { solicitud_id: solicitudId },
            })
            if (!existingCatalogo) {
              const vigencia =
                solicitud.vigencia_inicio && solicitud.vigencia_fin
                  ? `${solicitud.vigencia_inicio.toISOString().slice(0, 10)} / ${solicitud.vigencia_fin.toISOString().slice(0, 10)}`
                  : null
              await prisma.catalogo_justificacion.create({
                data: {
                  solicitud_id:              solicitudId,
                  regimen_contratacion:      (solicitud as any).regimen ?? "honorarios",
                  programa_proyecto:         (solicitud as any).programa_proyecto ?? "",
                  tipo_actividad:            (solicitud as any).tipo_actividades ?? null,
                  denominacion_nombramiento: (solicitud as any).denominacion ?? null,
                  puesto_jefe_inmediato:     (solicitud as any).puesto_jefe_inmediato ?? null,
                  numero_personas:           (solicitud as any).numero_prestadores ?? null,
                  tipo_pago:                 (solicitud as any).tipo_importe ?? null,
                  importe_bruto:             (solicitud as any).importe_bruto ?? null,
                  importe_neto:              null,
                  vigencia,
                  activo:                    true,
                  tipo_solicitud:            (solicitud as any).tipo_solicitud ?? null,
                  secretaria:                (solicitud as any).secretaria ?? null,
                  secretaria_txt_snapshot:   (solicitud as any).secretaria_txt_snapshot ?? null,
                  folio_recepcion:           (solicitud as any).folio_recepcion ?? null,
                  folio_dictamen:            (solicitud as any).folio_dictamen ?? null,
                },
              })
            }
          } catch (catalogError) {
            console.error("[firma-efirma/firmar-interno] Error al crear catálogo:", catalogError)
          }
        }
      } catch (emitErr: any) {
        console.error("[firma-efirma/firmar-interno] emisión automática falló:", emitErr)
      }
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok: true,
      firmados: result.firmadosLocal,
      estado: result.completo ? "completado" : estadoPortal,
      emision: emisionHecha ? { folio: folioDictamenFinal } : null,
      portal: portalRes,
    })
  } catch (err: any) {
    console.error("[firma-efirma/firmar-interno]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
