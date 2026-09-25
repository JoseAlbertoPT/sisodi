import { prisma } from "@/lib/prisma"

// Textos editables compartidos entre varias plantillas de PDF. Un registro
// por `clave` en configuracion_texto; si no existe todavía, se usa el valor
// por defecto y no se crea el registro hasta que alguien lo edite y guarde.

export const CLAVE_NOTA_DICTAMEN = "nota_dictamen"

export const NOTA_DICTAMEN_DEFAULT =
  "Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable."

export async function getTextoConfiguracion(clave: string, valorDefault: string): Promise<string> {
  const row = await prisma.configuracion_texto.findUnique({ where: { clave } })
  return row?.valor ?? valorDefault
}

// --- Nota del Dictamen por año ---------------------------------------------
// Cada año tiene su propia nota en `nota_dictamen_<año>`. La clave sin año
// (CLAVE_NOTA_DICTAMEN) es la nota anterior a este cambio y se toma como la de
// NOTA_DICTAMEN_ANIO_LEGADO; también es el respaldo de un año sin nota propia.
const PREFIJO_NOTA_ANIO = `${CLAVE_NOTA_DICTAMEN}_`
export const NOTA_DICTAMEN_ANIO_LEGADO = 2026

export const claveNotaDictamen = (anio: number) => `${PREFIJO_NOTA_ANIO}${anio}`

/** Nota de `anio` (por defecto el año en curso): la del año, o la anterior al cambio, o el texto por defecto. */
export async function getNotaDictamen(anio: number = new Date().getFullYear()): Promise<{ valor: string; existe: boolean }> {
  const rows = await prisma.configuracion_texto.findMany({
    where: { clave: { in: [claveNotaDictamen(anio), CLAVE_NOTA_DICTAMEN] } },
  })
  const propia = rows.find((r) => r.clave === claveNotaDictamen(anio))
  if (propia) return { valor: propia.valor, existe: true }
  const legado = rows.find((r) => r.clave === CLAVE_NOTA_DICTAMEN)
  return { valor: legado?.valor ?? NOTA_DICTAMEN_DEFAULT, existe: anio === NOTA_DICTAMEN_ANIO_LEGADO && !!legado }
}

/** Años que tienen nota propia (la nota sin año cuenta como NOTA_DICTAMEN_ANIO_LEGADO). */
export async function aniosNotaDictamen(): Promise<number[]> {
  const rows = await prisma.configuracion_texto.findMany({
    where: { clave: { startsWith: CLAVE_NOTA_DICTAMEN } },
    select: { clave: true },
  })
  const anios = new Set<number>()
  for (const { clave } of rows) {
    if (clave === CLAVE_NOTA_DICTAMEN) anios.add(NOTA_DICTAMEN_ANIO_LEGADO)
    else if (clave.startsWith(PREFIJO_NOTA_ANIO)) {
      const n = Number(clave.slice(PREFIJO_NOTA_ANIO.length))
      if (Number.isInteger(n)) anios.add(n)
    }
  }
  return [...anios].sort((a, b) => a - b)
}

export async function setTextoConfiguracion(clave: string, valor: string): Promise<string> {
  const row = await prisma.configuracion_texto.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  })
  return row.valor
}
