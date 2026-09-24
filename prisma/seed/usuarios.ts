import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

// Sin contraseña fija en el código: se toma de SEED_ADMIN_PASSWORD o se genera
// una aleatoria que se muestra UNA vez en consola. En ambos casos el admin
// debe cambiarla en su primer inicio de sesión.
const passwordDesdeEnv = process.env.SEED_ADMIN_PASSWORD
const ADMIN = {
  rfc: "ADMI000000AA0",
  password: passwordDesdeEnv || `${randomBytes(12).toString("base64url")}Aa1!`,
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
      must_change_password: true,
    },
  })
  if (passwordDesdeEnv) {
    console.log(`Usuario admin creado (RFC: ${ADMIN.rfc}, contraseña: la de SEED_ADMIN_PASSWORD)`)
  } else {
    console.log(`Usuario admin creado (RFC: ${ADMIN.rfc}, contraseña temporal: ${ADMIN.password}) — se pedirá cambiarla al entrar`)
  }
}

if (isMain(import.meta.url)) {
  runStandalone("usuarios", seedUsuarios)
}
