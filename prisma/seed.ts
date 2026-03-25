import "dotenv/config"
import { prisma } from "../lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  // 1. Crear roles base si no existen
  const roles = ["Administrador", "Enlace DO", "Enlace DGRH", "Consulta"]
  for (const nombre of roles) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre, activo: true },
    })
  }

  // 2. Crear área "Dirección de Organización" si no existe
  const area = await prisma.area.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: "Dirección de Organización", activo: true },
  })

  // 3. Obtener rol Administrador
  const rolAdmin = await prisma.rol.findUniqueOrThrow({
    where: { nombre: "Administrador" },
  })

  // 4. Crear usuario admin si no existe (por correo)
  const RFC = "ADMI000000AA0"
  const PASSWORD = "Admin123!"
  const CORREO = "admin@sisodij.gob.mx"

  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ correo: CORREO }, { rfc: RFC }] },
  })

  if (!existe) {
    const hash = await bcrypt.hash(PASSWORD, 12)
    await prisma.usuario.create({
      data: {
        nombre: "Administrador",
        correo: CORREO,
        rfc: RFC,
        password_hash: hash,
        rol_id: rolAdmin.id,
        area_id: area.id,
        activo: true,
        must_change_password: false,
      },
    })
    console.log("✅ Usuario admin creado")
    console.log(`   RFC:        ${RFC}`)
    console.log(`   Contraseña: ${PASSWORD}`)
    console.log(`   Correo:     ${CORREO}`)
  } else {
    console.log("ℹ️  Usuario admin ya existe, no se creó duplicado")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
