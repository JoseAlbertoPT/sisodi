import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { getProyectosCached, resolverIdDependencia } from "@/lib/sigef-cache"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const { searchParams } = new URL(req.url)
  const secretaria = searchParams.get("secretaria")?.trim()
  if (!secretaria) {
    return NextResponse.json({ error: "Falta secretaria" }, { status: 400 })
  }

  try {
    const idDependenciaNum = await resolverIdDependencia(secretaria)
    if (idDependenciaNum == null) {
      // Secretaría todavía sin idDependencia de SIGeF configurado (o el texto
      // guardado no se pudo emparejar con ninguna Secretaría conocida): el
      // formulario debe caer de regreso a su comportamiento actual, no es un error.
      return NextResponse.json({ configured: false, proyectos: [] })
    }

    const proyectos = await getProyectosCached(String(idDependenciaNum))

    const opciones = proyectos.map((p) => ({
      value: `${p.proyecto} - ${p.nombreProyecto}`,
      label: `${p.proyecto} - ${p.nombreProyecto}`,
    }))

    return NextResponse.json({ configured: true, proyectos: opciones })
  } catch (e) {
    console.error("[GET /api/sigef/proyectos]", e)
    return NextResponse.json(
      { error: mensajePublico(e, "Error al consultar SIGeF") },
      { status: 502 },
    )
  }
}
