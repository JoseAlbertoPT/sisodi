import bcrypt from "bcryptjs"
import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

const ADMIN = {
  rfc: "ADMI000000AA0",
  password: "Admin123!",
  correo: "admin@sisodij.gob.mx",
  nombre: "Administrador",
}

export async function seedUsuarios(prisma: PrismaClient) {
  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: "Administrador" } })
  const area = await prisma.area.findUniqueOrThrow({ where: { id: 1 } })

  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ correo: ADMIN.correo }, { rfc: ADMIN.rfc }] },
  })
  if (existe) {
    console.log("Usuario admin ya existe")
    return
  }

  const hash = await bcrypt.hash(ADMIN.password, 12)
  await prisma.usuario.create({
    data: {
      nombre: ADMIN.nombre,
      correo: ADMIN.correo,
      rfc: ADMIN.rfc,
      password_hash: hash,
      rol_id: rolAdmin.id,
      area_id: area.id,
      activo: true,
      must_change_password: false,
    },
  })
  console.log(`Usuario admin creado (RFC: ${ADMIN.rfc}, password: ${ADMIN.password})`)
}

if (isMain(import.meta.url)) {
  runStandalone("usuarios", seedUsuarios)
}
