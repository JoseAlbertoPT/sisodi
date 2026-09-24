import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireCatalogoAdmin } from "@/lib/api-guard"
import {
  leerWorkbookDesdeBuffer,
  cargarContexto,
  procesarFilas,
  insertarSolicitudes,
  actualizarSolicitudes,
  sincronizarCatalogo,
  calcularObsoletosPorReemplazo,
  eliminarSolicitudesObsoletas,
} from "@/lib/importar-catalogo-excel"

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const formData = await req.formData()
    const userId = formData.get("userId") as string | null
    const guardError = await requireCatalogoAdmin(userId)
    if (guardError) return guardError

    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 })
    }
    const actualizarExistentes = formData.get("actualizarExistentes") === "true"
    const reemplazarAnterior = formData.get("reemplazarAnterior") === "true"

    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, colActivo, formatoMultiHoja } = leerWorkbookDesdeBuffer(buffer)
    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo no tiene filas con datos" }, { status: 400 })
    }

    const contexto = await cargarContexto(prisma)
    const { toInsert, toUpdate, resumen } = procesarFilas(rows, colActivo, formatoMultiHoja, contexto, false, actualizarExistentes)

    const creadas = await insertarSolicitudes(toInsert, contexto, prisma, false)
    const actualizadas = await actualizarSolicitudes(toUpdate, contexto, prisma)
    const sync = await sincronizarCatalogo(prisma)

    // El reemplazo se calcula y aplica DESPUÉS de insertar/actualizar: las filas del
    // archivo nuevo ya están en el sistema, así que lo único que queda marcado como
    // "obsoleto" es lo que vino de una importación anterior y ya no aparece aquí.
    const eliminadas = reemplazarAnterior
      ? await eliminarSolicitudesObsoletas((await calcularObsoletosPorReemplazo(prisma, rows, colActivo)).ids, prisma)
      : 0

    return NextResponse.json({ creadas, actualizadas, eliminadas, resumen, sincronizacion: sync })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/importar/commit]", e)
    return NextResponse.json({ error: "Error al importar el archivo" }, { status: 500 })
  }
}
