import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCatalogoAdmin } from "@/lib/api-guard"
import {
  leerWorkbookDesdeBuffer,
  cargarContexto,
  procesarFilas,
  insertarSolicitudes,
  actualizarSolicitudes,
  sincronizarCatalogo,
} from "@/lib/importar-catalogo-excel"

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ creadas, actualizadas, resumen, sincronizacion: sync })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/importar/commit]", e)
    return NextResponse.json({ error: "Error al importar el archivo" }, { status: 500 })
  }
}
