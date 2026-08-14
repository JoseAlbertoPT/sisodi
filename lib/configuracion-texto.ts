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

export async function setTextoConfiguracion(clave: string, valor: string): Promise<string> {
  const row = await prisma.configuracion_texto.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  })
  return row.valor
}
