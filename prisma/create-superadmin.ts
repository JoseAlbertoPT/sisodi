import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const RFC      = process.env.SUPERADMIN_RFC      ?? "ADMI000000AA0"
const CORREO   = process.env.SUPERADMIN_EMAIL    ?? "admin@sisodij.gob.mx"
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "Admin123!"
const NOMBRE   = process.env.SUPERADMIN_NOMBRE   ?? "Super Administrador"
const ROL_NAME = "Administrador"
const AREA_NAME = "Dirección de Organización"

async function main() {
  const rol = await prisma.rol.upsert({
    where: { nombre: ROL_NAME },
    update: { activo: true },
    create: { nombre: ROL_NAME, activo: true },
  })

  const area = await prisma.area.upsert({
    where: { nombre: AREA_NAME },
    update: { activo: true },
    create: { nombre: AREA_NAME, activo: true },
  })

  const hash = await bcrypt.hash(PASSWORD, 12)

  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ correo: CORREO }, { rfc: RFC }] },
  })

  if (existe) {
    await prisma.usuario.update({
      where: { id: existe.id },
      data: {
        nombre: NOMBRE,
        correo: CORREO,
        rfc: RFC,
        password_hash: hash,
        rol_id: rol.id,
        area_id: area.id,
        activo: true,
        must_change_password: false,
      },
    })
    console.log("🔄 Superadmin actualizado (password reseteado)")
  } else {
    await prisma.usuario.create({
      data: {
        nombre: NOMBRE,
        correo: CORREO,
        rfc: RFC,
        password_hash: hash,
        rol_id: rol.id,
        area_id: area.id,
        activo: true,
        must_change_password: false,
      },
    })
    console.log("✅ Superadmin creado")
  }

  console.log(`   RFC:        ${RFC}`)
  console.log(`   Correo:     ${CORREO}`)
  console.log(`   Contraseña: ${PASSWORD}`)
  console.log(`   Rol:        ${ROL_NAME}`)
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
