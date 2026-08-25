import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

const FIRMANTES_INCLUDE = {
  firmantes: { orderBy: { orden: "asc" as const }, include: { usuario: { select: { id: true, nombre: true, rfc: true, correo: true } } } },
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const uuid = url.searchParams.get("uuid")
    const solicitudId = url.searchParams.get("solicitudId")

    let firma: any = null
    if (uuid) {
      firma = await prisma.firma_proceso.findUnique({ where: { uuid }, include: FIRMANTES_INCLUDE })
    } else if (solicitudId) {
      firma = await prisma.firma_proceso.findUnique({ where: { solicitud_id: Number(solicitudId) }, include: FIRMANTES_INCLUDE })
    } else {
      return NextResponse.json({ ok: false, error: "Falta uuid o solicitudId" }, { status: 400 })
    }

    if (!firma) {
      return NextResponse.json({ ok: true, firma: null })
    }

    // Regenerar automáticamente el link de cualquier firmante externo cuyo
    // token haya expirado sin haber firmado — así el admin nunca se topa con
    // un link muerto en este panel sin darse cuenta; el botón "Regenerar" (a
    // pedido manual) sigue disponible aparte para forzar uno nuevo en
    // cualquier momento, sin esperar a que expire.
    const ahora = new Date()
    for (const f of firma.firmantes as any[]) {
      if (f.tipo === "externo" && !f.firmado && f.expira_en && f.expira_en < ahora) {
        const nuevoToken = randomBytes(32).toString("hex")
        await prisma.firma_firmante.update({
          where: { id: f.id },
          data: { acceso_token: nuevoToken, accedido_en: null, expira_en: null, session_id: null },
        })
        f.acceso_token = nuevoToken
        f.accedido_en = null
        f.expira_en = null
        f.session_id = null
      }
    }

    const externosTotal = firma.firmantes.filter((f: any) => f.tipo === "externo").length
    const externosFirmados = firma.firmantes.filter((f: any) => f.tipo === "externo" && f.firmado).length
    const externosCompletos = externosTotal === 0 || externosFirmados === externosTotal

    return NextResponse.json({
      ok: true,
      firma: {
        id: firma.id,
        solicitud_id: firma.solicitud_id,
        tipo: firma.tipo,
        uuid: firma.uuid,
        total_firmantes: firma.total_firmantes,
        firmados: firma.firmados,
        archivo_firmado: firma.archivo_firmado,
        estado: firma.estado,
        fecha_creacion: firma.fecha_creacion,
        fecha_completado: firma.fecha_completado,
        externos_completos: externosCompletos,
        externos_total: externosTotal,
        externos_firmados: externosFirmados,
      },
      firmantes: firma.firmantes.map((f: any) => ({
        id: f.id,
        orden: f.orden,
        rol: f.rol,
        cargo: f.cargo,
        tipo: f.tipo,
        bandeja: f.bandeja,
        firmado: f.firmado,
        verificado: f.verificado,
        fecha_firma: f.fecha_firma,
        nombre: f.nombre ?? f.usuario?.nombre ?? null,
        rfc:    f.rfc    ?? f.usuario?.rfc    ?? null,
        correo: f.correo ?? f.usuario?.correo ?? null,
        cargo_firmante: f.cargo_firmante ?? null,
        usuario_id: f.usuario_id,
        acceso_token: f.tipo === "externo" ? f.acceso_token : null,
      })),
    })
  } catch (err: any) {
    console.error("[firma-efirma/estado]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
