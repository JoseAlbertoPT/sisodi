import { NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { esAdministrador } from "@/lib/api-guard"
import pool from "@/lib/db"

export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  // Reescribe la matriz de menús de todos los roles: solo Administrador.
  if (!esAdministrador(sesion.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const res = await pool.query(
    `SELECT id, nombre, key, parent_id, activo, orden, ruta FROM menu ORDER BY id ASC`
  )
  return NextResponse.json(res.rows)
}

export async function POST() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  // Reescribe la matriz de menús de todos los roles: solo Administrador.
  if (!esAdministrador(sesion.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const log: string[] = []

  // Fix parent_id for all known menu items
  await pool.query(`UPDATE menu SET parent_id = NULL WHERE id IN (1, 2, 6)`)
  log.push("✅ parent_id = NULL para ids 1, 2, 6")

  await pool.query(`UPDATE menu SET parent_id = 2 WHERE id IN (3, 4, 5)`)
  log.push("✅ parent_id = 2 (JUSTIFICACIONES) para ids 3, 4, 5")

  await pool.query(`UPDATE menu SET parent_id = 6, orden = 5 WHERE id = 10`)
  log.push("✅ id=10 Dictámenes → parent_id = 6 (GESTIÓN DGDO)")

  await pool.query(`UPDATE menu SET parent_id = 6 WHERE id IN (7, 8, 9, 14)`)
  log.push("✅ parent_id = 6 (GESTIÓN DGDO) para ids 7, 8, 9, 14")

  // Rename sections
  await pool.query(`UPDATE menu SET nombre = 'GESTIÓN DGDO', activo = true WHERE id = 6`)
  log.push("✅ id=6 renombrado → GESTIÓN DGDO")

  await pool.query(`UPDATE menu SET nombre = 'JUSTIFICACIONES', activo = true WHERE id = 2`)
  log.push("✅ id=2 renombrado → JUSTIFICACIONES")

  // Deactivate Progreso Firmado
  await pool.query(`UPDATE menu SET activo = false WHERE id = 14`)
  log.push("✅ id=14 Progreso Firmado desactivado")

  // Ensure correct keys on all leaf menus
  const keyUpdates: [string | null, number][] = [
    ["dashboard",        1],
    [null,               2],
    ["nueva-solicitud",  3],
    ["mis-solicitudes",  4],
    ["validacion-uefa",  5],
    [null,               6],
    ["bandeja-filtro1",  7],
    ["bandeja-filtro2",  8],
    ["bandeja-filtro3",  9],
    ["dictamenes",      10],
    ["calendario",      11],
    ["usuarios",        12],
    ["configuracion",   13],
    ["progreso-firmado",14],
  ]
  for (const [key, id] of keyUpdates) {
    await pool.query(`UPDATE menu SET key = $1 WHERE id = $2`, [key, id])
  }
  log.push("✅ Keys actualizados en todos los menús")

  // Create or find CONFIGURACIÓN section and assign ids 11, 12, 13
  const configRes = await pool.query(
    `SELECT id FROM menu WHERE nombre ILIKE '%CONFIGURACI%' AND parent_id IS NULL LIMIT 1`
  )
  let configId: number
  if (configRes.rowCount && configRes.rowCount > 0) {
    configId = configRes.rows[0].id
    await pool.query(
      `UPDATE menu SET nombre = 'CONFIGURACIÓN', activo = true, orden = 3 WHERE id = $1`,
      [configId]
    )
    log.push(`✅ Sección CONFIGURACIÓN ya existía (id=${configId})`)
  } else {
    const ins = await pool.query(
      `INSERT INTO menu (nombre, key, icono, ruta, orden, parent_id, activo)
       VALUES ('CONFIGURACIÓN', NULL, NULL, NULL, 3, NULL, true) RETURNING id`
    )
    configId = ins.rows[0].id
    log.push(`✅ Sección CONFIGURACIÓN creada (id=${configId})`)
  }

  await pool.query(`UPDATE menu SET parent_id = $1, activo = true, orden = 1 WHERE id = 11`, [configId])
  await pool.query(`UPDATE menu SET parent_id = $1, activo = true, orden = 2 WHERE id = 12`, [configId])
  await pool.query(`UPDATE menu SET parent_id = $1, activo = true, orden = 3 WHERE id = 13`, [configId])
  log.push(`✅ Calendario(11), Usuarios(12), Catálogo(13) bajo CONFIGURACIÓN (id=${configId})`)

  // Fix orders
  await pool.query(`UPDATE menu SET orden = 0 WHERE id = 1`)
  await pool.query(`UPDATE menu SET orden = 1 WHERE id = 2`)
  await pool.query(`UPDATE menu SET orden = 2 WHERE id = 6`)
  await pool.query(`UPDATE menu SET orden = 3 WHERE id = $1`, [configId])
  log.push("✅ Orden de secciones raíz corregido")

  // Verify final state
  const final = await pool.query(
    `SELECT id, nombre, key, parent_id, activo, orden FROM menu ORDER BY id ASC`
  )
  log.push("── Estado final ──")
  for (const r of final.rows) {
    log.push(`  id=${r.id} "${r.nombre}" key=${r.key ?? "null"} parent_id=${r.parent_id ?? "NULL"} activo=${r.activo}`)
  }

  return NextResponse.json({ ok: true, log })
}
