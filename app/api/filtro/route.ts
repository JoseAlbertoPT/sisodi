import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { getSecretariaScopeIds } from "@/lib/secretaria-scope"
import { checkSesionUsuario } from "@/lib/validar-sesion"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}

function estadoEnRevision(filtro: number) {
  if (filtro === 1) return "En Revision Revisor"
  if (filtro === 2) return "En Verificacion Final"
  return "En Revision Emisor"
}

function estadoObservado(filtro: number) {
  if (filtro === 1) return "Observado por Revisor"
  if (filtro === 2) return "Observado por Verificacion Final"
  return "Observado por Emisor"
}

function generarFolioTemporal(id: number, fecha: Date | null | undefined, sufijo?: number): string {
  const f    = fecha ?? new Date()
  const mes  = f.getMonth() + 1
  const anio = f.getFullYear()
  const ini  = INICIALES_MES[mes] ?? "XX"
  const num  = String(id).padStart(3, "0")
  return sufijo ? `${ini}-${num}-${sufijo}` : `${ini}-${num}-${anio}`
}

async function generarFolioDictamen(tipo: "dictamen" | "opinion"): Promise<string> {
  const ahora = new Date()
  const mes   = ahora.getMonth() + 1
  const anio  = ahora.getFullYear()
  const ini   = INICIALES_MES[mes] ?? "XX"
  const clave = tipo === "dictamen" ? "DICT" : "OPI"

  const registro = await prisma.consecutivo_folio.upsert({
    where:  { tipo_mes_anio: { tipo: clave, mes, anio } },
    update: { consecutivo: { increment: 1 } },
    create: { tipo: clave, mes, anio, consecutivo: 1 },
  })

  const num = String(registro.consecutivo ?? 1).padStart(3, "0")
  return `${ini}-${num}-${anio}`
}

function resolverFolioDictamen(item: any): string | null {
  return (
    item?.folioDictamen         ??
    item?.dictamen?.folio       ??
    item?.folio_dictamen        ??
    item?._raw?.folioDictamen   ??
    item?._raw?.dictamen?.folio ??
    item?._raw?.folio_dictamen  ??
    null
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filtroParam = searchParams.get("filtro")
    const filtro      = filtroParam ? parseInt(filtroParam, 10) : null

    if (!filtro || ![1, 2, 3].includes(filtro)) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'filtro' requerido (1, 2 o 3)" },
        { status: 400 }
      )
    }

    const estadosNombres = [
      estadoEnRevision(filtro),
      ...(filtro === 3 ? [estadoObservado(filtro)] : []),
      ...(filtro === 3 ? ["Pendiente Firma Dictamen", "Pendiente Firma Emisor"] : []),
      ...(filtro === 3 ? [
        "Pendiente DO",
        "En Revision Revisor",
        "Observado por Revisor",
        "Aceptado por Revisor",
        "Aprobado por Revisor",
        "Pendiente Firma Justificacion",
        "Pendiente Firma Revision",
        "Pendiente Firma Verificacion",
        "En Verificacion Final",
        "Observado por Verificacion Final",
      ] : []),
      ...(filtro === 1 ? [
        "Aceptado por Revisor",
        "Observado por Revisor",
        "Observado por Verificacion Final",
        "Pendiente Firma Revision",
      ] : []),
      ...(filtro === 2 ? [
        "Aprobado por Revisor",
        "Pendiente DO",
        "En Revision Revisor",
        "Observado por Emisor",
        "Observado por DO",
        "Observado por Verificacion Final",
        "Pendiente Firma Verificacion",
      ] : []),
    ]

    const estados = await prisma.estado.findMany({
      where: {
        OR: estadosNombres.map((nombre) => ({
          nombre: { equals: nombre, mode: "insensitive" as const },
        })),
      },
    })

    if (estados.length === 0) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const estadoIds = estados.map((e) => e.id)

    const revisorId    = searchParams.get("revisorId")
    const viewerUserId = searchParams.get("userId")

    let organoFilter: any = {}
    let tipoAdminFilter: any = {}
    let esRolRevisor = false
    let esAdmin = false

    if (viewerUserId) {
      const viewer = await prisma.usuario.findUnique({
        where:  { id: viewerUserId },
        select: {
          secretaria_id:       true,
          secretaria_texto:    true,
          organo_centralizado: { select: { id: true } },
          rol:                 { select: { nombre: true } },
        },
      })
      if (viewer) {
        esRolRevisor = viewer.rol?.nombre?.toLowerCase() === "revisor"
        esAdmin      = viewer.rol?.nombre?.toLowerCase() === "administrador"

        // Cada usuario solo ve solicitudes de su propio ámbito, sin importar el
        // rol: un usuario con órgano centralizado ve lo centralizado (incluye
        // registros sin tipo, tratados como centralizada); uno paraestatal solo
        // ve lo paraestatal.
        // `{ not: "paraestatal" }` excluye los NULL en SQL; por eso el OR explícito
        // con null para que los registros sin tipo se traten como centralizada.
        tipoAdminFilter = viewer.organo_centralizado
          ? { OR: [{ tipo_administracion: { not: "paraestatal" } }, { tipo_administracion: null }] }
          : { tipo_administracion: "paraestatal" }

        if (esRolRevisor && filtro !== 1) {
          return NextResponse.json({ ok: true, data: [] })
        }

        if (!esRolRevisor && !esAdmin) {
          if (viewer.secretaria_id) {
            // Alcance a nivel Secretaría: todos los nodos (Direcciones, etc.) de la
            // misma Secretaría, no solo el nodo exacto del usuario.
            const scopeIds = await getSecretariaScopeIds(viewer.secretaria_id)
            organoFilter = { secretaria_id_snapshot: { in: scopeIds } }
          } else if (viewer.secretaria_texto) {
            organoFilter = { secretaria_txt_snapshot: viewer.secretaria_texto }
          } else if (filtro !== 3) {
            // Filtro 1/2: sin secretaría configurada → no mostrar nada
            console.warn(`[filtro GET] Usuario ${viewerUserId} sin secretaría, filtro=${filtro} → vacío`)
            return NextResponse.json({ ok: true, data: [] })
          }
          // Filtro 3 (Emisión/DO): sin secretaría → ve todas las solicitudes
        }
        // Administrador: sin organoFilter → ve todas las solicitudes en cualquier filtro
      }
    }

    const whereClause: any = { estado_id: { in: estadoIds }, ...organoFilter, ...tipoAdminFilter }

    if (esRolRevisor && viewerUserId) {
      whereClause.revisor_asignado_id = viewerUserId
    } else if (!esAdmin && filtro === 1 && revisorId) {
      whereClause.revisor_asignado_id = revisorId
    }

    console.log(`[filtro GET] filtro=${filtro} estados=[${estadosNombres.join(", ")}] organoFilter=${JSON.stringify(organoFilter)} viewer=${viewerUserId ?? "none"}`)

    const _hoyBase = new Date()
    const hoyUTC = Date.UTC(_hoyBase.getUTCFullYear(), _hoyBase.getUTCMonth(), _hoyBase.getUTCDate())

    const solicitudes = await prisma.solicitud.findMany({
      where: whereClause,
      include: {
        estado:           true,
        periodo:          true,
        dictamen:         true,
        revisor_asignado: { select: { id: true, nombre: true, correo: true } },
        usuario: {
          select: {
            id:            true,
            nombre:        true,
            correo:        true,
            rfc:           true,
            secretaria_id: true,
            area:          { select: { id: true, nombre: true } },
            rol:           { select: { id: true, nombre: true } },
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
        checklist_detalle: {
          include: { checklist: true },
        },
        adjunto: true,
      },
      orderBy: { fecha_creacion: "desc" },
    })

    // --- ownership filter --------------------------------------------------
    // filtro=3 (Emisión) shows every pre-emission state as a tracking view
    // ("Estatus de recibidas"), regardless of whether Emisión has handled the
    // solicitud before — it does not need to have reached "En Revision Emisor"
    // in a prior cycle to be visible here.
    const solicitudesFiltradas = solicitudes
    // -----------------------------------------------------------------------

    const enriched = solicitudesFiltradas.map((sol) => {
      const historial = sol.historial_solicitud

      const firstObsIdx = historial.findIndex((h) =>
        (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase().includes("observad")
      )
      const reingresoCount = firstObsIdx === -1 ? 0 : historial.slice(firstObsIdx + 1).filter((h) => {
        const n2 = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
        return n2.includes("enviada a validacion") || n2.includes("en validacion justificaciones")
      }).length

      const lastObservacion = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("observad")
      })
      const lastObservedEstado =
        lastObservacion?.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? null

      const lastObservedStage = (() => {
        if (!lastObservedEstado) return null
        const n = lastObservedEstado.toLowerCase()
        if (n.includes("revisor")) return 1
        if (n.includes("verificacion final")) return 2
        if (n.includes("emisor")) return 3
        const m = lastObservedEstado.match(/filtro\s+(\d)/i)
        return m ? parseInt(m[1], 10) : null
      })()

      const lastObservedDate = lastObservacion?.fecha
        ? new Date(lastObservacion.fecha).toLocaleDateString("es-MX", {
            day: "2-digit", month: "2-digit", year: "numeric",
          })
        : null

      const slaRestante: number | null = sol.periodo?.fecha_fin
        ? (() => {
            const fin = new Date(sol.periodo.fecha_fin)
            const finUTC = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate())
            return Math.ceil((finUTC - hoyUTC) / (1000 * 60 * 60 * 24))
          })()
        : null

      const etapaFiltro    = `F${filtro}`
      const tieneFolioDictamen = !!(sol.dictamen?.folio ?? (sol as any).folio_dictamen)

      const lastAsignacionIdx = (() => {
        for (let i = historial.length - 1; i >= 0; i--) {
          const n = (historial[i].estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
          if (filtro === 1 && n === "en revision revisor")  return i
          if (filtro === 2 && n === "en verificacion final")  return i
          if (filtro === 3 && n === "en revision emisor")   return i
        }
        return -1
      })()
      const lastAccionFiltroIdx = (() => {
        for (let i = historial.length - 1; i >= 0; i--) {
          const n = (historial[i].estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
          if (filtro === 1 && (n.includes("observado por revisor") || n.includes("aceptado por revisor") || n.includes("aprobado por revisor"))) return i
          if (filtro === 2 && (n.includes("observado por verificacion final") || n.includes("en revision emisor"))) return i
          if (filtro === 3 && (n.includes("observado por emisor") || n.includes("pendiente firma dictamen"))) return i
        }
        return -1
      })()
      const esReingresoCiclo = lastAccionFiltroIdx >= 0 && lastAsignacionIdx > lastAccionFiltroIdx
      const openedInFiltro = esReingresoCiclo
        ? false
        : sol.checklist_detalle.some((cd) => cd.checklist?.etapa === etapaFiltro) || (filtro !== 3 && tieneFolioDictamen)

      const fueObservadaEnEsteFiltro = historial.some((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        const n = nombre.toLowerCase()
        if (!n.includes("observad")) return false
        if (filtro === 1) return n.includes("revisor") || n.includes("filtro 1")
        if (filtro === 2) return n.includes("verificacion final") || n.includes("filtro 2")
        if (filtro === 3) return n.includes("emisor") || n.includes("filtro 3")
        return false
      })

      const isNuevaEnFiltro = !fueObservadaEnEsteFiltro && !openedInFiltro
      const fechaParaFolio  = sol.fecha_envio ?? sol.fecha_creacion

      const { numParaFolioTemp, sufijoFolio } = (() => {
        if ((sol as any).folio_justificacion) {
          const partes = String((sol as any).folio_justificacion).split("-")
          if (partes.length >= 3) {
            const base = parseInt(partes[2], 10)
            const sufijo = partes.length === 4 ? parseInt(partes[3], 10) : undefined
            if (!isNaN(base) && base > 0) return { numParaFolioTemp: base, sufijoFolio: sufijo }
          }
        }
        return { numParaFolioTemp: sol.id, sufijoFolio: undefined }
      })()

      const folioRecepcion  = sol.folio_recepcion ?? null

      const fechaRecepcionDO = sol.fecha_envio
        ? new Date(sol.fecha_envio).toISOString().slice(0, 10)
        : sol.fecha_creacion
        ? new Date(sol.fecha_creacion).toISOString().slice(0, 10)
        : null

      const folioDictamen =
        sol.dictamen?.folio ??
        (sol as any).folio_dictamen ??
        null

      const rawEnriquecido = {
        ...sol,
        folioDictamen,
        folio_anterior: (sol as any).folio_anterior ?? null,
        dictamen: sol.dictamen
          ? { ...sol.dictamen, folio: sol.dictamen.folio }
          : folioDictamen
          ? { folio: folioDictamen }
          : null,
      }

      return {
        id:               String(sol.id),
        folioSolicitud:   folioRecepcion,
        folioRecepcion,
        folioDictamen,
        folioTemporal:    false,
        tipo:             sol.tipo_solicitud,
        denominacion:     (sol as any).denominacion || sol.tipo_solicitud || "—",
        secretaria:       (sol as any).secretaria ?? sol.usuario?.area?.nombre ?? "—",
        secretariaId:     sol.usuario?.secretaria_id ?? null,
        estado:           sol.estado.nombre,
        esRegularizacion: (sol as any).es_extemporanea ?? false,
        fechaRecepcionDO,
        periodo:          sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        reingresoCount,
        lastObservedStage,
        lastObservedDate,
        lastObservedEstado,
        slaRestante,
        openedInFiltro:   { [filtro]: openedInFiltro }  as Record<number, boolean>,
        isNuevaEnFiltro:  { [filtro]: isNuevaEnFiltro } as Record<number, boolean>,
        revisorAsignado:  (sol as any).revisor_asignado ?? null,
        esHistoricoImportado: historial.some((h) => (h.comentario ?? "").includes("Importado de histórico consolidado DGSAC")),
        _raw: rawEnriquecido,
      }
    })

    return NextResponse.json({ ok: true, data: enriched })
  } catch (error: any) {
    console.error("[GET /api/filtro]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes del filtro" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, accion, filtro, usuarioId, observaciones, folioDictamen, folioRecepcion, revisorId, modalidadFirma } = body

    if (!solicitudId || !accion || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, accion, usuarioId" },
        { status: 400 }
      )
    }

    if (!["aprobar", "observar", "asignarFolio", "asignarFolioRecepcion", "aceptar", "asignarRevisor"].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Use 'aprobar', 'observar', 'asignarFolio', 'asignarFolioRecepcion', 'aceptar' o 'asignarRevisor'" },
        { status: 400 }
      )
    }

    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json(
        { ok: false, error: "solicitudId debe ser un número válido" },
        { status: 400 }
      )
    }

    // Validar que el usuario que ejecuta la acción exista en la base, para evitar
    // el error de FK `historial_solicitud_usuario_id_fkey` cuando el navegador tiene
    // una sesión vieja (ver lib/validar-sesion.ts).
    const sesionErr = await checkSesionUsuario(usuarioId)
    if (sesionErr) return sesionErr

    // Si se asigna revisor, validar también que el revisor exista para no violar
    // la FK `solicitud_revisor_asignado_id_fkey`.
    if (revisorId) {
      const revisorExiste = await prisma.usuario.findUnique({
        where:  { id: revisorId },
        select: { id: true },
      })
      if (!revisorExiste) {
        return NextResponse.json(
          { ok: false, error: "El revisor seleccionado no existe en el sistema. Actualiza la lista e inténtalo de nuevo." },
          { status: 400 }
        )
      }
    }

    if (accion === "asignarFolio") {
      if (!folioDictamen) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'folioDictamen' para la acción asignarFolio" },
          { status: 400 }
        )
      }

      const solicitudExistente = await prisma.solicitud.findUnique({
        where:   { id: idNum },
        include: { dictamen: true },
      })

      if (!solicitudExistente) {
        return NextResponse.json(
          { ok: false, error: "Solicitud no encontrada" },
          { status: 404 }
        )
      }

      const modalidadExistente = (solicitudExistente as any).modalidad_firma ?? "autografa"
      if (solicitudExistente.dictamen) {
        await prisma.dictamen.update({
          where: { solicitud_id: idNum },
          data:  { folio: folioDictamen, tipo_firma: modalidadExistente },
        })
      } else {
        await prisma.dictamen.create({
          data: {
            solicitud_id:  idNum,
            folio:         folioDictamen,
            fecha_emision: new Date(),
            tipo_firma:    modalidadExistente,
            archivo_pdf:   null,
          },
        })
      }

      try {
        await prisma.solicitud.update({
          where: { id: idNum },
          data:  { folio_dictamen: folioDictamen } as any,
        })
      } catch {
      }

      try {
        const partes = folioDictamen.split("/")
        if (partes.length === 3) {
          const consecutivoNum = parseInt(partes[0], 10)
          const mesNum         = parseInt(partes[1], 10)
          const anioNum        = parseInt(partes[2], 10)
          if (!isNaN(consecutivoNum) && !isNaN(mesNum) && !isNaN(anioNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FDICT", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FDICT", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
        }
      } catch {  }

      broadcastUpdate(ALL_APARTADOS)
      return NextResponse.json({
        ok:            true,
        accion:        "asignarFolio",
        folioDictamen,
      })
    }

    if (accion === "asignarFolioRecepcion") {
      if (!folioRecepcion) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'folioRecepcion' para la acción asignarFolioRecepcion" },
          { status: 400 }
        )
      }

      const solicitudExistente = await prisma.solicitud.findUnique({ where: { id: idNum } })
      if (!solicitudExistente) {
        return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 })
      }

      await prisma.solicitud.update({
        where: { id: idNum },
        data:  { folio_recepcion: folioRecepcion },
      })

      try {
        const MONTH_CODES = ["EN","FE","MR","AB","MY","JN","JL","AG","SE","OC","NO","DI"]
        const partes = folioRecepcion.split("-")

        if (partes.length === 3 && /^\d{4}$/.test(partes[2])) {
          // Nuevo formato con año: MY-001-2026
          const mesNum         = MONTH_CODES.indexOf(partes[0]) + 1
          const consecutivoNum = parseInt(partes[1], 10)
          const anioNum        = parseInt(partes[2], 10)
          if (mesNum > 0 && !isNaN(consecutivoNum) && !isNaN(anioNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FREC", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FREC", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
        } else if (partes.length === 3) {
          // Extemporánea temporal: MY-001-1 (último folio + nº de extemporánea)
          const anioNum        = new Date().getFullYear()
          const mesNum         = MONTH_CODES.indexOf(partes[0]) + 1
          const consecutivoNum = parseInt(partes[1], 10)
          const extNum         = parseInt(partes[2], 10)
          if (mesNum > 0 && !isNaN(consecutivoNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FREC", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FREC", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
          if (mesNum > 0 && !isNaN(extNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FREC_EXT", mes: mesNum, anio: anioNum } },
              update: { consecutivo: extNum },
              create: { tipo: "FREC_EXT", mes: mesNum, anio: anioNum, consecutivo: extNum },
            })
          }
        } else if (partes.length === 2) {
          // Formato anterior sin año: MY-001 (compatibilidad con registros existentes)
          const anioNum        = new Date().getFullYear()
          const mesNum         = MONTH_CODES.indexOf(partes[0]) + 1
          const consecutivoNum = parseInt(partes[1], 10)
          if (mesNum > 0 && !isNaN(consecutivoNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FREC", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FREC", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
        }
      } catch {  }

      broadcastUpdate(ALL_APARTADOS)
      return NextResponse.json({ ok: true, accion: "asignarFolioRecepcion", folioRecepcion })
    }

    if (accion === "asignarRevisor") {
      if (!revisorId) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'revisorId' para la acción asignarRevisor" },
          { status: 400 }
        )
      }
      let estadoRevision = await prisma.estado.findFirst({
        where: { nombre: { equals: "En Revision Revisor", mode: "insensitive" } },
      })
      if (!estadoRevision) {
        estadoRevision = await prisma.estado.create({
          data: { nombre: "En Revision Revisor", descripcion: "Solicitud enviada a revisión por revisor asignado" },
        })
      }
      const solicitudActual = await prisma.solicitud.findUnique({
        where: { id: idNum },
        select: { estado_id: true },
      })

      await prisma.solicitud.update({
        where: { id: idNum },
        data:  {
          revisor_asignado_id: revisorId,
          estado_id: estadoRevision.id,
        },
      })
      await prisma.historial_solicitud.create({
        data: {
          solicitud_id:       idNum,
          usuario_id:         usuarioId,
          estado_anterior_id: solicitudActual?.estado_id ?? null,
          estado_nuevo_id:    estadoRevision.id,
          comentario:         "Enviada a revisión con revisor asignado desde Validación Final",
        },
      })
      broadcastUpdate(ALL_APARTADOS)
      return NextResponse.json({
        ok: true, accion: "asignarRevisor",
        estadoNuevo: "En Revision Revisor",
        revisorId,
      })
    }

    if (accion === "aceptar") {
      let estadoAceptado = await prisma.estado.findFirst({
        where: { nombre: { equals: "Aceptado por Revisor", mode: "insensitive" } },
      })
      if (!estadoAceptado) {
        estadoAceptado = await prisma.estado.create({
          data: { nombre: "Aceptado por Revisor", descripcion: "Solicitud aceptada por el Revisor asignado" },
        })
      }
      const solicitudActual = await prisma.solicitud.findUnique({ where: { id: idNum }, select: { estado_id: true } })
      await prisma.solicitud.update({ where: { id: idNum }, data: { estado_id: estadoAceptado.id } })
      await prisma.historial_solicitud.create({
        data: {
          solicitud_id:       idNum,
          usuario_id:         usuarioId,
          estado_anterior_id: solicitudActual?.estado_id ?? null,
          estado_nuevo_id:    estadoAceptado.id,
          comentario:         "Revisión aceptada por el Revisor",
        },
      })
      broadcastUpdate(ALL_APARTADOS)
      return NextResponse.json({ ok: true, estadoNuevo: "Aceptado por Revisor" })
    }

    if (!filtro) {
      return NextResponse.json(
        { ok: false, error: "Se requiere 'filtro' para las acciones aprobar/observar" },
        { status: 400 }
      )
    }

    const solicitud = await prisma.solicitud.findUnique({
      where:   { id: idNum },
      include: {
        estado: true,
        dictamen: true,
        historial_solicitud: {
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado: true,
          },
        },
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    // Filtro 2 solo puede aprobar/observar mientras la solicitud sigue en su
    // bandeja activa: recién llegada ("En Verificacion Final") o devuelta por
    // Emisión para su revisión ("Observado por Emisor"). Sin esto, una pestaña
    // vieja o "Observadas" (que muestra el historial para seguimiento) puede
    // reenviar la acción sobre una solicitud que ya avanzó o que está parada
    // en su propio marcador de observada ("Observado por Verificacion Final"),
    // duplicando transiciones de estado.
    const estadoActualFiltro2 = solicitud.estado.nombre.toLowerCase()
    const estadosActivosFiltro2 = [estadoEnRevision(2).toLowerCase(), "observado por emisor"]
    if (filtro === 2 && !estadosActivosFiltro2.includes(estadoActualFiltro2)) {
      return NextResponse.json(
        { ok: false, error: `La solicitud ya no está en Verificación (estado actual: "${solicitud.estado.nombre}"). Actualiza la bandeja.` },
        { status: 409 }
      )
    }

    const yaEsperoPorFiltro1 = solicitud.historial_solicitud.some((h) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      return nombre.toLowerCase().includes("en revision revisor")
    })

    let nombreEstadoNuevo: string
    if (accion === "aprobar") {
      if (filtro === 1) {
        nombreEstadoNuevo = estadoEnRevision(2)
      } else if (filtro === 2) {
        nombreEstadoNuevo = yaEsperoPorFiltro1 ? estadoEnRevision(3) : estadoEnRevision(1)
      } else {
        const estadoActual = solicitud.estado.nombre.toLowerCase()
        if (estadoActual.includes("pendiente firma dictamen")) {
          nombreEstadoNuevo = "Emitido"
        } else if (modalidadFirma === "autografa") {
          // Firma autógrafa: todo se resuelve dentro de Emisión (descarga/sube el
          // dictamen sellado ahí mismo) — no pasa por "Pendiente Firma Justificacion"
          // ni por la bandeja de Validación UEFA.
          nombreEstadoNuevo = "Pendiente Firma Dictamen"
        } else {
          nombreEstadoNuevo = "Pendiente Firma Justificacion"
        }
      }
    } else {
      const estadoActualNorm = solicitud.estado.nombre.toLowerCase()
      if (filtro === 1 && estadoActualNorm.includes("aceptado por revisor")) {
        nombreEstadoNuevo = "Observado por DO"
      } else {
        nombreEstadoNuevo = estadoObservado(filtro)
      }
    }

    let estadoNuevo = await prisma.estado.findFirst({
      where: { nombre: { equals: nombreEstadoNuevo, mode: "insensitive" } },
    })
    if (!estadoNuevo) {
      estadoNuevo = await prisma.estado.create({
        data: {
          nombre:      nombreEstadoNuevo,
          descripcion: `Estado creado automáticamente: ${nombreEstadoNuevo}`,
        },
      })
    }

    const comentario =
      accion === "observar" && observaciones
        ? Array.isArray(observaciones)
          ? observaciones.join(" | ")
          : String(observaciones)
        : null

    const asignarRevisor = filtro === 2 && nombreEstadoNuevo === estadoEnRevision(1) && revisorId
    const guardarModalidad = accion === "aprobar" && filtro === 3 && (modalidadFirma === "electronica" || modalidadFirma === "autografa")

    const solicitudActualizada = await prisma.solicitud.update({
      where: { id: idNum },
      data:  {
        estado_id: estadoNuevo.id,
        ...(asignarRevisor ? { revisor_asignado_id: revisorId } : {}),
        ...(guardarModalidad ? { modalidad_firma: modalidadFirma } : {}),
      },
      include: {
        estado:  true,
        periodo: true,
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            area:   { select: { id: true, nombre: true } },
          },
        },
      },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:       idNum,
        usuario_id:         usuarioId,
        estado_anterior_id: solicitud.estado_id,
        estado_nuevo_id:    estadoNuevo.id,
        comentario,
      },
    })

    if (accion === "aprobar" && filtro === 3 && nombreEstadoNuevo === "Emitido") {
      try {
        const folioAsignado = (solicitud as any).folio_dictamen ?? solicitud.dictamen?.folio ?? null
        const ahora = new Date()

        let estadoEmitido = await prisma.estado.findFirst({
          where: { nombre: { equals: "Emitido", mode: "insensitive" } },
        })
        if (!estadoEmitido) {
          estadoEmitido = await prisma.estado.create({
            data: {
              nombre:      "Emitido",
              descripcion: "Dictamen/Opinión emitido por la Dirección de Organización",
            },
          })
        }

        const updates: any[] = [
          prisma.solicitud.update({
            where: { id: idNum },
            data:  { estado_id: estadoEmitido.id, fecha_emision: ahora } as any,
          }),
          prisma.historial_solicitud.create({
            data: {
              solicitud_id:       idNum,
              usuario_id:         usuarioId,
              estado_anterior_id: estadoNuevo.id,
              estado_nuevo_id:    estadoEmitido.id,
              comentario: folioAsignado
                ? `Dictamen emitido. Folio: ${folioAsignado} | Tipo firma: ${(solicitud as any).modalidad_firma ?? modalidadFirma ?? "autografa"}`
                : "Dictamen emitido",
            },
          }),
        ]

        const modalidadSolicitud = (solicitud as any).modalidad_firma ?? modalidadFirma ?? "autografa"
        if (folioAsignado && !solicitud.dictamen) {
          updates.unshift(
            prisma.dictamen.create({
              data: {
                solicitud_id:  idNum,
                folio:         folioAsignado,
                fecha_emision: ahora,
                tipo_firma:    modalidadSolicitud,
                archivo_pdf:   null,
              },
            })
          )
        } else if (solicitud.dictamen) {
          updates.push(
            prisma.dictamen.update({
              where: { solicitud_id: idNum },
              data: { tipo_firma: modalidadSolicitud },
            })
          )
        }

        await prisma.$transaction(updates)

        // Auto-crear entrada en catálogo de justificaciones (best-effort)
        try {
          const existing = await prisma.catalogo_justificacion.findUnique({
            where: { solicitud_id: idNum },
          })
          if (!existing) {
            const vigencia =
              solicitud.vigencia_inicio && solicitud.vigencia_fin
                ? `${(solicitud.vigencia_inicio as Date).toISOString().slice(0, 10)} / ${(solicitud.vigencia_fin as Date).toISOString().slice(0, 10)}`
                : null
            await prisma.catalogo_justificacion.create({
              data: {
                solicitud_id:              idNum,
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
          console.error("[EMISION Filtro 3] Error al crear catálogo:", catalogError)
        }

        return NextResponse.json({
          ok:            true,
          estadoNuevo:   "Emitido",
          folioDictamen: folioAsignado,
          data:          solicitudActualizada,
        })
      } catch (emisionError: any) {
        console.error("[EMISION Filtro 3]", emisionError)
        return NextResponse.json({
          ok:               true,
          estadoNuevo:      nombreEstadoNuevo,
          folioDictamen:    null,
          autoEmisionError: emisionError?.message ?? "Error en emisión",
          data:             solicitudActualizada,
        })
      }
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok:            true,
      estadoNuevo:   nombreEstadoNuevo,
      folioDictamen: solicitud.dictamen?.folio ?? (solicitud as any).folio_anterior ?? null,
      data:          solicitudActualizada,
    })
  } catch (error: any) {
    console.error("[PATCH /api/filtro]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al procesar la acción del filtro" },
      { status: 500 }
    )
  }
}