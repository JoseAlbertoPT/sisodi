import { NextRequest, NextResponse } from "next/server"
import { CLAVE_NOTA_DICTAMEN, NOTA_DICTAMEN_DEFAULT, getTextoConfiguracion, setTextoConfiguracion } from "@/lib/configuracion-texto"

export async function GET() {
  try {
    const valor = await getTextoConfiguracion(CLAVE_NOTA_DICTAMEN, NOTA_DICTAMEN_DEFAULT)
    return NextResponse.json({ ok: true, valor })
  } catch (e) {
    console.error("[GET /api/configuracion/nota-dictamen]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { valor } = await req.json().catch(() => ({ valor: null }))
    if (typeof valor !== "string" || valor.trim() === "") {
      return NextResponse.json({ ok: false, error: "El texto de la nota es requerido" }, { status: 400 })
    }
    const guardado = await setTextoConfiguracion(CLAVE_NOTA_DICTAMEN, valor.trim())
    return NextResponse.json({ ok: true, valor: guardado })
  } catch (e) {
    console.error("[PUT /api/configuracion/nota-dictamen]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
