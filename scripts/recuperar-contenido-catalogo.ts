/**
 * Recupera el contenido de Carta/Dictamen (objeto, actividades, perfil...) en
 * los registros de catalogo_justificacion que lo tienen vacío.
 *
 * Contexto: hasta ahora el catálogo no guardaba ese contenido (dependía de la
 * solicitud vinculada). Si la solicitud se borró — p. ej. al reimportar con
 * "reemplazar importación anterior" — la carta sale solo con los títulos.
 * Desde lib/catalogo-contenido.ts los registros nuevos ya guardan su copia.
 *
 * Fuentes, en orden:
 *   1. La solicitud vinculada (si solicitud_id sigue existiendo).
 *   2. Un respaldo JSON de importación (--respaldo <ruta>), emparejando por
 *      folio de dictamen + secretaría. Si el par se repite con contenido
 *      distinto, se omite (ambiguo) y se reporta.
 *
 * Solo llena campos VACÍOS: nunca sobrescribe lo que ya tenga el catálogo.
 *
 * Uso:
 *   npx tsx scripts/recuperar-contenido-catalogo.ts --respaldo backup-ultima-importacion-406-20260922.json
 *       → solo muestra lo que cambiaría (no escribe nada)
 *   npx tsx scripts/recuperar-contenido-catalogo.ts --respaldo <ruta> --aplicar
 *       → aplica los cambios en una sola transacción
 */
import "dotenv/config"
import { readFileSync } from "fs"
import { Client } from "pg"

const args = process.argv.slice(2)
const APLICAR = args.includes("--aplicar")
const iResp = args.indexOf("--respaldo")
const RUTA_RESPALDO = iResp >= 0 ? args[iResp + 1] : null

const CAMPOS_TEXTO = ["objeto", "escolaridad", "comp_adm", "comp_tec", "comp_soc", "valores", "areas_exp",
  "unidad_administrativa", "unidad_responsable", "folio_justificacion"] as const
const CAMPOS_LISTA = ["actividades", "responsabilidades"] as const
const CAMPOS_FECHA = ["vigencia_inicio", "vigencia_fin"] as const
const TODOS = [...CAMPOS_TEXTO, ...CAMPOS_LISTA, ...CAMPOS_FECHA]

type Fila = Record<string, any>

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const vacio = (v: unknown) =>
  v === null || v === undefined || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "")
const fecha = (v: unknown) => (vacio(v) ? null : String(v instanceof Date ? v.toISOString() : v).slice(0, 10))

/** Campos del catálogo vacíos que la fuente sí trae. */
function faltantes(cat: Fila, fuente: Fila): Fila {
  const out: Fila = {}
  for (const c of TODOS) {
    if (!vacio(cat[c]) || vacio(fuente[c])) continue
    out[c] = (CAMPOS_FECHA as readonly string[]).includes(c) ? fecha(fuente[c]) : fuente[c]
  }
  return out
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  console.log(`Base: ${String(process.env.DATABASE_URL).replace(/:\/\/[^@]*@/, "://***@")}`)
  console.log(APLICAR ? "Modo: APLICAR (escribe en la base)\n" : "Modo: SIMULACIÓN (no escribe nada; agrega --aplicar para guardar)\n")

  const catalogo: Fila[] = (await db.query(
    `SELECT id, solicitud_id, folio_dictamen, secretaria, ${TODOS.join(", ")} FROM catalogo_justificacion ORDER BY id`,
  )).rows

  // Fuente 1: solicitudes vinculadas que siguen existiendo.
  const ids = catalogo.map((c) => c.solicitud_id).filter((x) => x != null)
  const solicitudes = new Map<number, Fila>()
  if (ids.length) {
    const r = await db.query(`SELECT id, ${TODOS.join(", ")} FROM solicitud WHERE id = ANY($1::int[])`, [ids])
    for (const s of r.rows) solicitudes.set(s.id, s)
  }

  // Fuente 2: respaldo JSON, por folio de dictamen + secretaría.
  const respaldo = new Map<string, Fila | "ambiguo">()
  if (RUTA_RESPALDO) {
    const json = JSON.parse(readFileSync(RUTA_RESPALDO, "utf8"))
    for (const s of (json.solicitudes ?? []) as Fila[]) {
      if (!s.folio_dictamen) continue
      const k = `${norm(s.folio_dictamen)}|${norm(s.secretaria)}`
      const previo = respaldo.get(k)
      if (!previo) respaldo.set(k, s)
      else if (previo !== "ambiguo" && JSON.stringify(TODOS.map((c) => previo[c])) !== JSON.stringify(TODOS.map((c) => s[c]))) {
        respaldo.set(k, "ambiguo")
      }
    }
    console.log(`Respaldo: ${RUTA_RESPALDO} (${respaldo.size} folios)`)
  }

  const cambios: { id: number; folio: string; fuente: string; datos: Fila }[] = []
  let completos = 0, sinFuente = 0, ambiguos = 0
  const ejemplosSinFuente: string[] = []

  for (const cat of catalogo) {
    if (TODOS.every((c) => !vacio(cat[c]))) { completos++; continue }
    let datos: Fila = {}, fuente = ""
    const sol = cat.solicitud_id != null ? solicitudes.get(cat.solicitud_id) : undefined
    if (sol) { datos = faltantes(cat, sol); fuente = "solicitud" }
    if (Object.keys(datos).length === 0 && respaldo.size) {
      const r = respaldo.get(`${norm(cat.folio_dictamen)}|${norm(cat.secretaria)}`)
      if (r === "ambiguo") { ambiguos++; continue }
      if (r) { datos = faltantes(cat, r); fuente = "respaldo" }
    }
    if (Object.keys(datos).length === 0) {
      sinFuente++
      if (ejemplosSinFuente.length < 10) ejemplosSinFuente.push(`#${cat.id} ${cat.folio_dictamen} (${cat.secretaria ?? "sin secretaría"})`)
      continue
    }
    cambios.push({ id: cat.id, folio: cat.folio_dictamen, fuente, datos })
  }

  console.log(`Registros en catálogo:           ${catalogo.length}`)
  console.log(`  ya completos (sin cambios):    ${completos}`)
  console.log(`  a recuperar:                   ${cambios.length}` +
    `  (desde solicitud: ${cambios.filter((c) => c.fuente === "solicitud").length}, desde respaldo: ${cambios.filter((c) => c.fuente === "respaldo").length})`)
  console.log(`  ambiguos en el respaldo:       ${ambiguos}`)
  console.log(`  sin fuente para recuperar:     ${sinFuente}`)
  if (ejemplosSinFuente.length) console.log(`    ej.: ${ejemplosSinFuente.join(", ")}`)

  for (const c of cambios.slice(0, 5)) {
    const resumen = Object.entries(c.datos).map(([k, v]) =>
      `${k}=${Array.isArray(v) ? `[${v.length}]` : typeof v === "string" && v.length > 30 ? `"${v.slice(0, 30)}…"` : JSON.stringify(v)}`)
    console.log(`  · #${c.id} ${c.folio} (${c.fuente}): ${resumen.join(", ")}`)
  }
  if (cambios.length > 5) console.log(`  · … y ${cambios.length - 5} más`)

  if (APLICAR && cambios.length) {
    await db.query("BEGIN")
    try {
      for (const c of cambios) {
        const cols = Object.keys(c.datos)
        const sets = cols.map((col, i) => `${col} = $${i + 2}`).join(", ")
        await db.query(`UPDATE catalogo_justificacion SET ${sets} WHERE id = $1`, [c.id, ...cols.map((col) => c.datos[col])])
      }
      await db.query("COMMIT")
      console.log(`\n✅ ${cambios.length} registros actualizados.`)
    } catch (e) {
      await db.query("ROLLBACK")
      console.error("\n❌ Error; no se guardó ningún cambio:", e)
      process.exitCode = 1
    }
  }
  await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
