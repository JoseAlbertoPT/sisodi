import { prisma } from "@/lib/prisma"
import { consultarDependenciasSigef } from "@/lib/sigef-client"
import { normalizeText } from "@/lib/utils"
import { MANUAL_OVERRIDES } from "@/lib/importar-catalogo-excel"
import { ensureOrganismoParaestatal } from "@/lib/sync-organismo-paraestatal"

// Mantiene las Secretarías del catálogo (organo_centralizado, nodos raíz) al
// día con el catálogo de dependencias de SIGeF:
//  - Secretaría nueva en SIGeF        -> se da de alta en el catálogo.
//  - SIGeF le cambia el idDependencia -> se actualiza sigef_id_dependencia.
//  - SIGeF le cambia el nombre        -> se conserva el nombre local (muchas
//    tablas guardan la Secretaría como texto y dejarían de emparejar) y se
//    reporta para que el administrador decida si lo renombra.
// Las unidades y proyectos de cada Secretaría no necesitan esto: se consultan
// a SIGeF en vivo (ver lib/sigef-cache.ts).
//
// Una dependencia se reconoce, en este orden, por su idDependencia, por su
// nombre (el local o el que SIGeF tenía antes) y por su codigoDependencia.

// SIGeF también lista agrupadores presupuestales que no son Secretarías del
// sector central (30 Municipios, 40 Organismos, 50 Tribunales, 60 Poder
// Legislativo, ...). Solo el sector central (código < 30) va a este catálogo.
const CODIGO_MAX_SECTOR_CENTRAL = 30

export interface ResultadoSyncSigef {
  at: string
  creadas: string[]
  idsActualizados: { nombre: string; antes: number | null; ahora: number }[]
  nombresCambiados: { nombreLocal: string; antes: string; ahora: string }[]
  yaNoEnSigef: string[]
  sinVincular: string[]
}

function esSectorCentral(codigo: string): boolean {
  const n = Number(codigo)
  return Number.isInteger(n) && n > 0 && n < CODIGO_MAX_SECTOR_CENTRAL
}

const overridesNormalizados = new Map(
  Object.entries(MANUAL_OVERRIDES).map(([raw, canonico]) => [normalizeText(raw), normalizeText(canonico)]),
)

function nombresDe(nodo: { nombre: string; sigef_nombre: string | null }): string[] {
  const nombres = [normalizeText(nodo.nombre)]
  const canonico = overridesNormalizados.get(nombres[0])
  if (canonico) nombres.push(canonico)
  if (nodo.sigef_nombre) nombres.push(normalizeText(nodo.sigef_nombre))
  return nombres
}

let enCurso: Promise<ResultadoSyncSigef> | null = null
/** Llamadas simultáneas (arranque + intervalo) comparten la misma corrida. */
export function sincronizarDependenciasSigef(): Promise<ResultadoSyncSigef> {
  enCurso ??= ejecutar().finally(() => {
    enCurso = null
  })
  return enCurso
}

async function ejecutar(): Promise<ResultadoSyncSigef> {
  const dependencias = (await consultarDependenciasSigef()).filter((d) => esSectorCentral(d.codigoDependencia))
  // Una respuesta vacía casi seguro es falla de SIGeF, no que desaparecieron
  // todas las Secretarías: no se toca nada.
  if (dependencias.length === 0) throw new Error("SIGeF no devolvió dependencias del sector central")

  const nodos = await prisma.organo_centralizado.findMany({
    where: { parent_id: null },
    select: { id: true, nombre: true, orden: true, sigef_id_dependencia: true, sigef_nombre: true, sigef_codigo: true },
  })

  const resultado: ResultadoSyncSigef = {
    at: new Date().toISOString(),
    creadas: [],
    idsActualizados: [],
    nombresCambiados: [],
    yaNoEnSigef: [],
    sinVincular: [],
  }
  type Nodo = (typeof nodos)[number]
  type Dep = (typeof dependencias)[number]
  const validas = dependencias.filter((d) => Number.isInteger(Number(d.idDependencia)))

  // Se empareja por niveles sobre TODAS las dependencias (primero todas por
  // id, luego por nombre, luego por código), para que un emparejamiento débil
  // no le gane el nodo a otra dependencia que lo reconoce por id.
  const vinculo = new Map<Dep, Nodo>()
  const vinculados = new Set<string>()
  const libres = () => nodos.filter((n) => !vinculados.has(n.id))
  const criterios: ((n: Nodo, d: Dep) => boolean)[] = [
    (n, d) => n.sigef_id_dependencia === Number(d.idDependencia),
    (n, d) => nombresDe(n).includes(normalizeText(d.dependencia)),
    (n, d) => n.sigef_codigo === d.codigoDependencia,
  ]
  for (const coincide of criterios) {
    for (const dep of validas) {
      if (vinculo.has(dep)) continue
      const nodo = libres().find((n) => coincide(n, dep))
      if (!nodo) continue
      vinculo.set(dep, nodo)
      vinculados.add(nodo.id)
    }
  }

  let siguienteOrden = nodos.reduce((max, n) => Math.max(max, n.orden), -1) + 1

  for (const dep of validas) {
    const idDependencia = Number(dep.idDependencia)
    const nodo = vinculo.get(dep)

    if (!nodo) {
      await prisma.$transaction(async (tx) => {
        const creada = await tx.organo_centralizado.create({
          data: {
            nombre: dep.dependencia.trim(),
            parent_id: null,
            orden: siguienteOrden++,
            tipo: "SECRETARIA",
            sigef_id_dependencia: idDependencia,
            sigef_nombre: dep.dependencia,
            sigef_codigo: dep.codigoDependencia,
          },
        })
        await ensureOrganismoParaestatal(tx, creada.nombre)
      })
      resultado.creadas.push(dep.dependencia)
      continue
    }

    if (nodo.sigef_id_dependencia !== idDependencia) {
      resultado.idsActualizados.push({ nombre: nodo.nombre, antes: nodo.sigef_id_dependencia, ahora: idDependencia })
    }
    if (nodo.sigef_nombre && normalizeText(nodo.sigef_nombre) !== normalizeText(dep.dependencia)) {
      resultado.nombresCambiados.push({ nombreLocal: nodo.nombre, antes: nodo.sigef_nombre, ahora: dep.dependencia })
    }
    if (
      nodo.sigef_id_dependencia !== idDependencia ||
      nodo.sigef_nombre !== dep.dependencia ||
      nodo.sigef_codigo !== dep.codigoDependencia
    ) {
      await prisma.organo_centralizado.update({
        where: { id: nodo.id },
        data: { sigef_id_dependencia: idDependencia, sigef_nombre: dep.dependencia, sigef_codigo: dep.codigoDependencia },
      })
    }
  }

  // No se borran ni se desvinculan: pueden tener usuarios y unidades, y una
  // dependencia que "desaparece" puede ser una respuesta incompleta de SIGeF.
  for (const n of libres()) {
    if (n.sigef_id_dependencia != null) resultado.yaNoEnSigef.push(n.nombre)
    else resultado.sinVincular.push(n.nombre)
  }

  const cambios = resultado.creadas.length + resultado.idsActualizados.length + resultado.nombresCambiados.length
  if (cambios > 0) console.log("[sigef sync] cambios aplicados:", JSON.stringify(resultado))

  return resultado
}
