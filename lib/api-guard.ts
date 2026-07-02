import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function requireRol(userId: string | null, rolesPermitidos: string[]): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: { select: { nombre: true } } },
  })
  if (!usuario || !rolesPermitidos.includes(usuario.rol.nombre)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}
