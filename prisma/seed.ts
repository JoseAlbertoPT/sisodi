import { prisma } from "../lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  
  const roles = ["Administrador", "Director Operativo", "Analista", "Revisor", "Capturista", "Enlace DO", "Enlace DGRH", "Consulta"]
  for (const nombre of roles) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre, activo: true },
    })
  }

  
  const area = await prisma.area.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: "Dirección de Organización", activo: true },
  })

  
  const rolAdmin = await prisma.rol.findUniqueOrThrow({
    where: { nombre: "Administrador" },
  })

  
  const acciones = ["Ver", "Crear", "Editar", "Eliminar"]
  for (const nombre of acciones) {
    await prisma.accion.upsert({
      where: { id: acciones.indexOf(nombre) + 1 },
      update: {},
      create: { id: acciones.indexOf(nombre) + 1, nombre },
    })
  }

  
  const menus = [
    { id: 1,  nombre: "Tablero",              key: "dashboard",         icono: "LayoutDashboard", ruta: "/dashboard",         orden: 1,  parent_id: null },
    { id: 2,  nombre: "Solicitudes",           key: null,                icono: "FileText",        ruta: null,                 orden: 2,  parent_id: null },
    { id: 3,  nombre: "Nueva solicitud",       key: "nueva-solicitud",   icono: "FilePlus",        ruta: "/nueva-solicitud",   orden: 1,  parent_id: 2 },
    { id: 4,  nombre: "Mis solicitudes",       key: "mis-solicitudes",   icono: "FileText",        ruta: "/mis-solicitudes",   orden: 2,  parent_id: 2 },
    { id: 5,  nombre: "Validación UEFA",       key: "validacion-uefa",   icono: "FileCheck",       ruta: "/validacion-uefa",   orden: 3,  parent_id: 2 },
    { id: 6,  nombre: "Bandejas",              key: null,                icono: "Filter",          ruta: null,                 orden: 3,  parent_id: null },
    { id: 7,  nombre: "Revision",              key: "bandeja-filtro1",   icono: "Filter",          ruta: "/bandeja-filtro1",   orden: 1,  parent_id: 6 },
    { id: 8,  nombre: "Validacion",            key: "bandeja-filtro2",   icono: "Filter",          ruta: "/bandeja-filtro2",   orden: 2,  parent_id: 6 },
    { id: 9,  nombre: "Emision",               key: "bandeja-filtro3",   icono: "Filter",          ruta: "/bandeja-filtro3",   orden: 3,  parent_id: 6 },
    { id: 14, nombre: "Progreso Firmado",      key: "progreso-firmado",  icono: "ClipboardCheck",  ruta: "/progreso-firmado",  orden: 4,  parent_id: 6 },
    { id: 10, nombre: "Dictámenes",            key: "dictamenes",        icono: "ShieldCheck",     ruta: "/dictamenes",        orden: 4,  parent_id: null },
    { id: 11, nombre: "Calendario",            key: "calendario",        icono: "CalendarDays",    ruta: "/calendario",        orden: 5,  parent_id: null },
    { id: 12, nombre: "Usuarios",              key: "usuarios",          icono: "Users",           ruta: "/usuarios",          orden: 6,  parent_id: null },
    { id: 13, nombre: "Catálogo",               key: "configuracion",     icono: "Settings",        ruta: "/configuracion",     orden: 7,  parent_id: null },
  ]

  for (const m of menus) {
    await prisma.menu.upsert({
      where: { id: m.id },
      update: { nombre: m.nombre, key: m.key, icono: m.icono, ruta: m.ruta, orden: m.orden, parent_id: m.parent_id, activo: true },
      create: { id: m.id, nombre: m.nombre, key: m.key, icono: m.icono, ruta: m.ruta, orden: m.orden, parent_id: m.parent_id, activo: true },
    })
  }

  
  for (const m of menus) {
    const rolMenu = await prisma.rol_menu.upsert({
      where: { rol_id_menu_id: { rol_id: rolAdmin.id, menu_id: m.id } },
      update: {},
      create: { rol_id: rolAdmin.id, menu_id: m.id },
    })
    
    for (const a of acciones) {
      const accionId = acciones.indexOf(a) + 1
      await prisma.rol_menu_accion.upsert({
        where: { rol_menu_id_accion_id: { rol_menu_id: rolMenu.id, accion_id: accionId } },
        update: {},
        create: { rol_menu_id: rolMenu.id, accion_id: accionId, activo: true },
      })
    }
  }
  console.log("✅ Menús y permisos creados para Administrador")

  
  const estados = [
    "En Captura",
    "Borrador",
    "En Validacion Justificaciones",
    "Observado por Validacion",
    "En Revision Revisor",
    "Observado por Revisor",
    "Pendiente Firma Justificacion",
    "En Validacion Final",
    "Observado por Validacion Final",
    "En Revision Emisor",
    "Observado por Emisor",
    "Pendiente Firma Dictamen",
    "Emitido",
    "Rechazado",
  ]
  for (const nombre of estados) {
    await prisma.estado.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }
  console.log("✅ Estados de flujo creados")

  
  const EJERCICIO = 2026
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]

  const calendarioRows: { ejercicio: number; regimen: string; periodo: string; limite_do: string; limite_dgrh: string }[] = []

  for (const mes of MESES) {
    const mesIdx = MESES.indexOf(mes) + 1
    const mm = String(mesIdx).padStart(2, "0")
    
    calendarioRows.push({
      ejercicio: EJERCICIO, regimen: "honorarios", periodo: mes,
      limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}`,
    })
    
    if (mes !== "Enero") {
      calendarioRows.push(
        { ejercicio: EJERCICIO, regimen: "asimilados",    periodo: `1ra ${mes}`, limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}` },
        { ejercicio: EJERCICIO, regimen: "nombramiento",  periodo: `1ra ${mes}`, limite_do: `01/${mm}/${EJERCICIO}`, limite_dgrh: `15/${mm}/${EJERCICIO}` },
      )
    }
    if (mes !== "Diciembre") {
      calendarioRows.push(
        { ejercicio: EJERCICIO, regimen: "asimilados",    periodo: `2da ${mes}`, limite_do: `15/${mm}/${EJERCICIO}`, limite_dgrh: `01/${mm}/${EJERCICIO}` },
        { ejercicio: EJERCICIO, regimen: "nombramiento",  periodo: `2da ${mes}`, limite_do: `15/${mm}/${EJERCICIO}`, limite_dgrh: `01/${mm}/${EJERCICIO}` },
      )
    }
  }

  await prisma.calendario.deleteMany({ where: { ejercicio: EJERCICIO } })
  await prisma.calendario.createMany({ data: calendarioRows })
  console.log(`✅ Calendario ${EJERCICIO} creado (${calendarioRows.length} registros)`)

  
  for (let mes = 1; mes <= 12; mes++) {
    const inicio = new Date(EJERCICIO, mes - 1, 1)
    const fin = new Date(EJERCICIO, mes, 0)
    await prisma.periodo.upsert({
      where: { mes_anio: { mes, anio: EJERCICIO } },
      update: {},
      create: { mes, anio: EJERCICIO, fecha_inicio: inicio, fecha_fin: fin, activo: true },
    })
  }
  console.log(`✅ Periodos ${EJERCICIO} creados`)

  
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
