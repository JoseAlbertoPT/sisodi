import "dotenv/config"
import { readFileSync } from "fs"
import { join } from "path"
import { prisma } from "../lib/prisma"

// Reproduce el mismo flujo que POST /api/solicitudes (app/api/solicitudes/route.ts)
// para poder insertar en lote sin pasar por el formulario.

const USUARIO_ID = "6de77e33-a525-4cc0-a78e-3e8293554500" // Admin / admin@gob.mx
const TIPO_SOLICITUD = "Prestacion de Servicios" // regimen HONORARIOS -> flujo "prestacion"
const ESTADO_NOMBRE = "En Captura"
const PERIODO_MES = 1
const PERIODO_ANIO = 2026

type Registro = {
  secretaria: string
  unidad_administrativa: string
  unidad_responsable: string
  programa_proyecto: string
  regimen: string
  tipo_actividades: string
  numero_prestadores: number
  vigencia_inicio: string
  vigencia_fin: string
  importe_bruto: number
  tipo_importe: string
  nivel_tabulador: string | null
  categoria_tabulador: string | null
  objeto: string
  actividades: string[]
  responsabilidades: string[]
  escolaridad: string
  comp_adm: string
  comp_tec: string
  comp_soc: string
  valores: string
  areas_exp: string
}

async function resolverPeriodoId(mes: number, anio: number): Promise<number> {
  let periodo = await prisma.periodo.findUnique({ where: { mes_anio: { mes, anio } } })
  if (!periodo) {
    const primerDia = new Date(Date.UTC(anio, mes - 1, 1))
    const ultimoDia = new Date(Date.UTC(anio, mes, 0))
    periodo = await prisma.periodo.create({ data: { mes, anio, fecha_inicio: primerDia, fecha_fin: ultimoDia } })
  }
  return periodo.id
}

async function crearSolicitud(reg: Registro) {
  const usuarioCreador = await prisma.usuario.findUnique({
    where: { id: USUARIO_ID },
    select: { secretaria_id: true, secretaria_texto: true, area_id: true },
  })
  if (!usuarioCreador) throw new Error(`usuario ${USUARIO_ID} no existe`)

  const tipoFolioJUST = usuarioCreador.secretaria_id
    ? `JUST-${usuarioCreador.secretaria_id}`
    : usuarioCreador.area_id
      ? `JUST-A-${usuarioCreador.area_id}`
      : `JUST-SEC-${reg.secretaria.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 30)}`

  const estadoInicial = await prisma.estado.findFirstOrThrow({
    where: { nombre: { equals: ESTADO_NOMBRE, mode: "insensitive" } },
  })
  const periodoId = await resolverPeriodoId(PERIODO_MES, PERIODO_ANIO)

  const nueva = await prisma.solicitud.create({
    data: {
      usuario_id: USUARIO_ID,
      estado_id: estadoInicial.id,
      tipo_solicitud: TIPO_SOLICITUD,
      tipo_administracion: "centralizada",
      secretaria_id_snapshot: usuarioCreador.secretaria_id ?? null,
      periodo_id: periodoId,
      es_extemporanea: false,
      secretaria: reg.secretaria,
      unidad_administrativa: reg.unidad_administrativa,
      unidad_responsable: reg.unidad_responsable,
      programa_proyecto: reg.programa_proyecto,
      regimen: reg.regimen,
      tipo_actividades: reg.tipo_actividades,
      numero_prestadores: reg.numero_prestadores,
      vigencia_inicio: new Date(reg.vigencia_inicio),
      vigencia_fin: new Date(reg.vigencia_fin),
      importe_bruto: reg.importe_bruto,
      es_renovacion: false,
      nivel_tabulador: reg.nivel_tabulador,
      categoria_tabulador: reg.categoria_tabulador,
      objeto: reg.objeto,
      actividades: reg.actividades,
      responsabilidades: reg.responsabilidades,
      escolaridad: reg.escolaridad,
      comp_adm: reg.comp_adm,
      comp_tec: reg.comp_tec,
      comp_soc: reg.comp_soc,
      valores: reg.valores,
      areas_exp: reg.areas_exp,
      marco_normativo: [],
      condiciones_riesgos: [],
      tipo_importe: reg.tipo_importe,
    },
  })

  const year = (nueva.fecha_creacion ?? new Date()).getFullYear()
  const registro = await prisma.consecutivo_folio.upsert({
    where: { tipo_mes_anio: { tipo: tipoFolioJUST, mes: 0, anio: year } },
    update: { consecutivo: { increment: 1 } },
    create: { tipo: tipoFolioJUST, mes: 0, anio: year, consecutivo: 1 },
  })
  const folioJustificacion = `JUST-${year}-${String(registro.consecutivo ?? 1).padStart(4, "0")}`

  const actualizada = await prisma.solicitud.update({
    where: { id: nueva.id },
    data: { folio_justificacion: folioJustificacion },
  })

  await prisma.historial_solicitud.create({
    data: {
      solicitud_id: nueva.id,
      estado_nuevo_id: estadoInicial.id,
      usuario_id: USUARIO_ID,
      comentario: "Solicitud creada por importación en lote (script import-honorarios-2026-01.ts)",
    },
  })

  return actualizada
}

async function main() {
  const dataPath = join(__dirname, "import-honorarios-2026-01.data.json")
  const registros: Registro[] = JSON.parse(readFileSync(dataPath, "utf-8"))

  console.log(`Insertando ${registros.length} solicitudes...`)
  for (const [i, reg] of registros.entries()) {
    const solicitud = await crearSolicitud(reg)
    console.log(
      `[${i + 1}/${registros.length}] id=${solicitud.id} folio=${solicitud.folio_justificacion} ` +
        `unidad="${reg.unidad_administrativa}" importe=${reg.importe_bruto}`
    )
  }
  console.log("Listo.")
}

main()
  .catch((e) => {
    console.error("ERROR", e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
