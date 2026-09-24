import { NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}

// Solo lectura: previsualiza el folio de recepción que se asignará al
// aprobar (ver Regla 11 en /api/filtro PATCH), sin incrementar el
// consecutivo — el número real se sigue generando de forma atómica en el
// PATCH al confirmar. Aquí puede haber una carrera si dos aprobaciones caen
// en el mismo instante, pero es aceptable para un texto informativo.
export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const ahora = new Date()
    const mes = ahora.getMonth() + 1
    const anio = ahora.getFullYear()
    const registro = await prisma.consecutivo_folio.findUnique({
      where: { tipo_mes_anio: { tipo: "FREC", mes, anio } },
    })
    const siguiente = (registro?.consecutivo ?? 0) + 1
    const ini = INICIALES_MES[mes] ?? "XX"
    const folio = `${ini}-${String(siguiente).padStart(3, "0")}-${anio}`
    return NextResponse.json({ ok: true, folio })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
