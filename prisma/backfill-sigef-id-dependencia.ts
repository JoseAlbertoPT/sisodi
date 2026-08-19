import "dotenv/config"
import { prisma } from "../lib/prisma"
import { consultarDependenciasSigef } from "../lib/sigef-client"
import { normalizeText } from "../lib/utils"
import { MANUAL_OVERRIDES } from "../lib/importar-catalogo-excel"

// Repone el mapeo Secretaría -> SIGeF idDependencia en organo_centralizado.
// Se hizo una vez el 2026-08-17 pero como acción manual contra la BD de
// desarrollo (nunca se guardó como script), así que cualquier BD nueva
// (producción incluida) se queda con sigef_id_dependencia = NULL en todas
// las filas después de `prisma migrate deploy` — el formulario y el catálogo
// caen silenciosamente a "no hay programas/proyectos" para todas las
// Secretarías. Este script reproduce ese backfill y es seguro de re-correr
// (siempre parte del catálogo real de SIGeF, no de un archivo estático).

const COMMIT = process.argv.includes("--commit")

async function main() {
  console.log("Consultando catálogo de dependencias de SIGeF...")
  const dependenciasSigef = await consultarDependenciasSigef()
  console.log(`  ${dependenciasSigef.length} dependencias recibidas de SIGeF.`)

  const porNombreSigef = new Map(dependenciasSigef.map((d) => [normalizeText(d.dependencia), d]))
  const overridesNormalizados = new Map(
    Object.entries(MANUAL_OVERRIDES).map(([raw, canonico]) => [normalizeText(raw), canonico]),
  )

  const nodos = await prisma.organo_centralizado.findMany({
    where: { parent_id: null },
    select: { id: true, nombre: true, sigef_id_dependencia: true },
  })
  console.log(`Secretarías raíz en organo_centralizado: ${nodos.length}`)

  const updates: { id: number; nombre: string; idDependencia: number }[] = []
  const sinMatch: { id: number; nombre: string }[] = []

  for (const nodo of nodos) {
    const normNombre = normalizeText(nodo.nombre)
    let hit = porNombreSigef.get(normNombre)
    if (!hit) {
      const canonico = overridesNormalizados.get(normNombre)
      if (canonico) hit = porNombreSigef.get(normalizeText(canonico))
    }
    if (!hit) {
      sinMatch.push({ id: nodo.id, nombre: nodo.nombre })
      continue
    }
    const idDependencia = Number(hit.idDependencia)
    if (nodo.sigef_id_dependencia === idDependencia) continue // ya está correcto
    updates.push({ id: nodo.id, nombre: nodo.nombre, idDependencia })
  }

  console.log(`\n──────── REPORTE ────────`)
  console.log(`Para actualizar: ${updates.length}`)
  for (const u of updates) console.log(`  [${u.id}] "${u.nombre}" -> sigef_id_dependencia=${u.idDependencia}`)
  console.log(`Sin match en el catálogo de SIGeF: ${sinMatch.length}`)
  for (const s of sinMatch) console.log(`  [${s.id}] "${s.nombre}"`)

  if (!COMMIT) {
    console.log(`\nModo dry-run (sin --commit). No se escribió nada en la base de datos.`)
    return
  }

  console.log(`\nActualizando ${updates.length} registros...`)
  for (const u of updates) {
    await prisma.organo_centralizado.update({
      where: { id: u.id },
      data: { sigef_id_dependencia: u.idDependencia },
    })
  }
  console.log(`Listo.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
