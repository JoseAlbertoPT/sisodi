import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consultarProyectosSigef } from "@/lib/sigef-client"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secretaria = searchParams.get("secretaria")?.trim()
  if (!secretaria) {
    return NextResponse.json({ error: "Falta secretaria" }, { status: 400 })
  }

  try {
    const nodo = await prisma.organo_centralizado.findFirst({
      where: { parent_id: null, nombre: { equals: secretaria, mode: "insensitive" } },
      select: { sigef_id_unidad: true },
    })
    if (!nodo?.sigef_id_unidad) {
      // Secretaría todavía sin idUnidad de SIGeF configurado: el formulario
      // debe caer de regreso a su comportamiento actual, no es un error.
      return NextResponse.json({ configured: false, proyectos: [] })
    }

    const idUnidad = nodo.sigef_id_unidad
    const proyectos = await consultarProyectosSigef(idUnidad)
    const vistos = new Set<string>()
    const opciones = proyectos
      .filter((p) => String(p.idUnidad) === String(idUnidad))
      .filter((p) => {
        if (vistos.has(p.proyecto)) return false
        vistos.add(p.proyecto)
        return true
      })
      .map((p) => ({
        value: `${p.proyecto} - ${p.nombreProyecto}`,
        label: `${p.proyecto} - ${p.nombreProyecto}`,
      }))

    return NextResponse.json({ configured: true, proyectos: opciones })
  } catch (e) {
    console.error("[GET /api/sigef/proyectos]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al consultar SIGeF" },
      { status: 502 },
    )
  }
}
