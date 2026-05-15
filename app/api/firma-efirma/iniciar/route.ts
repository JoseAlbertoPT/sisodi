import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"
import { efirmaClient } from "@/lib/efirma-client"
import { plantillaFirmantes, resolverUsuariosInternos, usuarioIdParaFirmante } from "@/lib/firma-plantillas"

const BYPASS = process.env.EFIRMA_BYPASS === "true"
const BYPASS_DIR = join(process.cwd(), ".firma-bypass")

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, archivo, nombre, creadoPorId } = body

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

    const existente = await prisma.firma_proceso.findUnique({ where: { solicitud_id: idNum } })
    if (existente && existente.estado !== "cancelado") {
      return NextResponse.json({ ok: false, error: "Ya existe un proceso de firma para esta solicitud" }, { status: 409 })
    }

    const plantilla = plantillaFirmantes(solicitud.tipo_solicitud)
    const totalFirmantes = plantilla.length

    // Iniciar proceso en el portal SIN firmar (firmarAhora=false).
    // Sólo creamos el proceso; las firmas se registrarán después (externos por link, internos desde el app).
    let procesoId: string
    let storageKey: string
    if (BYPASS) {
      procesoId  = `bypass-${idNum}-${Date.now()}`
      storageKey = randomBytes(16).toString("hex")
      try {
        await mkdir(BYPASS_DIR, { recursive: true })
        const base64 = String(archivo).replace(/^data:application\/pdf;base64,/, "")
        await writeFile(join(BYPASS_DIR, `${storageKey}.pdf`), Buffer.from(base64, "base64"))
      } catch (e) {
        console.error("[firma-efirma/iniciar] bypass: error guardando PDF local", e)
        return NextResponse.json(
          { ok: false, error: "No se pudo guardar el PDF en modo bypass" },
          { status: 500 },
        )
      }
    } else {
      const portalRes = await efirmaClient.iniciar({
        firmarAhora: false,
        nombre: nombre ?? `Justificacion-${idNum}`,
        archivo,
        totalFirmantes,
      })
      procesoId  = portalRes?.procesoId ?? portalRes?.proceso_id
      storageKey = portalRes?.storageKey ?? portalRes?.uuid ?? portalRes?.procesoUuid
      if (!procesoId || !storageKey) {
        return NextResponse.json({ ok: false, error: "Respuesta inválida del portal de firmas", detalle: portalRes }, { status: 502 })
      }
    }

    // Resolver internos desde historial
    const internos = await resolverUsuariosInternos(idNum)

    // Crear firma_proceso + firmantes en transacción
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
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
