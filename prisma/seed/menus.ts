import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"
import { ACCIONES, seedAcciones } from "./acciones"
import { seedRoles } from "./roles"

type MenuRow = {
  id: number
  nombre: string
  key: string | null
  icono: string | null
  ruta: string | null
  orden: number
  parent_id: number | null
}

export const MENUS: MenuRow[] = [
  { id: 1,  nombre: "JUSTIFICACIONES",  key: null,                icono: null,              ruta: null,                orden: 1, parent_id: null },
  { id: 2,  nombre: "Tablero",           key: "dashboard",         icono: "LayoutDashboard", ruta: "/dashboard",         orden: 1, parent_id: 1 },
  { id: 3,  nombre: "Nueva solicitud",   key: "nueva-solicitud",   icono: "FilePlus",        ruta: "/nueva-solicitud",   orden: 2, parent_id: 1 },
  { id: 4,  nombre: "Mis solicitudes",   key: "mis-solicitudes",   icono: "FileText",        ruta: "/mis-solicitudes",   orden: 3, parent_id: 1 },
  { id: 5,  nombre: "Validación UEFA",   key: "validacion-uefa",   icono: "FileCheck",       ruta: "/validacion-uefa",   orden: 4, parent_id: 1 },

  { id: 6,  nombre: "GESTIÓN DGDO",      key: null,                icono: null,              ruta: null,                orden: 2, parent_id: null },
  { id: 7,  nombre: "Revision",          key: "bandeja-filtro1",   icono: "Filter",          ruta: "/bandeja-filtro1",   orden: 1, parent_id: 6 },
  { id: 8,  nombre: "Validacion",        key: "bandeja-filtro2",   icono: "Filter",          ruta: "/bandeja-filtro2",   orden: 2, parent_id: 6 },
  { id: 9,  nombre: "Emision",           key: "bandeja-filtro3",   icono: "Filter",          ruta: "/bandeja-filtro3",   orden: 3, parent_id: 6 },
  { id: 10, nombre: "Dictámenes",        key: "dictamenes",        icono: "ShieldCheck",     ruta: "/dictamenes",        orden: 4, parent_id: 6 },

  { id: 11, nombre: "CONFIGURACIÓN",     key: null,                icono: null,              ruta: null,                orden: 3, parent_id: null },
  { id: 12, nombre: "Calendario",        key: "calendario",        icono: "CalendarDays",    ruta: "/calendario",        orden: 1, parent_id: 11 },
  { id: 13, nombre: "Usuarios",          key: "usuarios",          icono: "Users",           ruta: "/usuarios",          orden: 2, parent_id: 11 },
  { id: 14, nombre: "Catálogo",          key: "configuracion",     icono: "Settings",        ruta: "/configuracion",     orden: 3, parent_id: 11 },
]

const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn()
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.log(`  Tabla ${label} no existe, se omite`)
      return
    }
    throw e
  }
}

export async function seedMenus(prisma: PrismaClient) {
  await seedRoles(prisma)
  await seedAcciones(prisma)

  await safeDelete("rol_menu_accion", () => prisma.rol_menu_accion.deleteMany({}))
  await safeDelete("rol_menu", () => prisma.rol_menu.deleteMany({}))
  await safeDelete("usuario_menu", () => prisma.usuario_menu.deleteMany({}))
  await safeDelete("menu", () => prisma.menu.deleteMany({}))

  for (const m of MENUS.filter((x) => x.parent_id === null)) {
    await prisma.menu.create({
      data: { ...m, parent_id: null, activo: true },
    })
  }
  for (const m of MENUS.filter((x) => x.parent_id !== null)) {
    await prisma.menu.create({
      data: { ...m, activo: true },
    })
  }
  console.log(`Menús: ${MENUS.length}`)

  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: "Administrador" } })
  for (const m of MENUS) {
    const rm = await prisma.rol_menu.create({
      data: { rol_id: rolAdmin.id, menu_id: m.id },
    })
    for (let i = 0; i < ACCIONES.length; i++) {
      await prisma.rol_menu_accion.create({
        data: { rol_menu_id: rm.id, accion_id: i + 1, activo: true },
      })
    }
  }
  console.log("Permisos asignados a Administrador")

  const max = Math.max(...MENUS.map((m) => m.id))
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('menu','id'), ${max}, true)`,
  )
}

if (isMain(import.meta.url)) {
  runStandalone("menus", seedMenus)
}
