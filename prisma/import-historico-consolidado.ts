import "dotenv/config"
import { readFileSync } from "node:fs"
import { prisma } from "../lib/prisma"
import {
  leerWorkbookDesdeBuffer,
  cargarContexto,
  procesarFilas,
  insertarSolicitudes,
} from "../lib/importar-catalogo-excel"

const FILE_PATH   = process.argv.find((a) => !a.startsWith("--") && a.endsWith(".xlsx"))
  ?? "C:/Users/SAFDGSAC035/Downloads/BD-CATALOGO-SISODIJ-DGSAC_CONSOLIDADO.xlsx"
const COMMIT        = process.argv.includes("--commit")
const MODO_BORRADOR = process.argv.includes("--borradores")

async function main() {
  console.log(`Leyendo: ${FILE_PATH}`)
  const buffer = readFileSync(FILE_PATH)
  const { rows, colActivo, formatoMultiHoja, formatoLabel } = leerWorkbookDesdeBuffer(buffer)
  console.log(`Formato: ${formatoLabel}`)
  console.log(`Filas con datos: ${rows.length}`)

  const contexto = await cargarContexto(prisma)
  const { toInsert, resumen } = procesarFilas(rows, colActivo, formatoMultiHoja, contexto, MODO_BORRADOR)

  console.log("\n──────── REPORTE ────────")
  console.log(`Total filas:                 ${resumen.totalFilas}`)
  console.log(`Ya importadas (se omiten):   ${resumen.yaImportadosCount}`)
  console.log(`Listas para importar:        ${resumen.listasParaImportar}`)
  console.log(`Con errores (se omiten):     ${resumen.conErrores}`)
  console.log(`Sin folio de dictamen:       ${resumen.sinFolioDictamen}`)
  console.log(`Régimen no reconocido:       ${resumen.regimenNoReconocido}`)
  console.log(`Sin periodo (mes/año):       ${resumen.sinPeriodo}`)
  console.log(`Secretarías sin match en catálogo (se guardan tal cual, texto libre):`)
  for (const { nombre, count } of resumen.secretariasNoMatch) {
    console.log(`  (${count}) ${nombre}`)
  }
  if (resumen.filasConError.length > 0) {
    console.log("\nDetalle de filas con error (fila de Excel, no se importan):")
    for (const r of resumen.filasConError) {
      console.log(`  Fila ${r.idx} [${r.secretariaRaw}] folio=${r.folioDictamen || "(sin folio)"}: ${r.errores.join(" | ")}`)
    }
  }
  if (resumen.filasConAdvertencia.length > 0) {
    console.log(`\n${resumen.filasConAdvertencia.length} filas se importan con advertencias, revisar manualmente:`)
    for (const r of resumen.filasConAdvertencia) {
      console.log(`  Fila ${r.idx} [${r.secretariaRaw}] folio=${r.folioDictamen || "(sin folio)"}: ${r.advertencias.join(" | ")}`)
    }
  }

  if (!COMMIT) {
    console.log("\nModo dry-run (sin --commit). No se escribió nada en la base de datos.")
    return
  }

  console.log(`\nEscribiendo ${toInsert.length} solicitudes...`)
  const creadas = await insertarSolicitudes(toInsert, contexto, prisma, MODO_BORRADOR)
  console.log(`Listo. ${creadas} solicitudes creadas.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
