// Tipos de pago (Configuración > Tipos de pago). Sin Prisma: lo usan tanto la
// API como los componentes cliente.

export interface TipoPago {
  id: number
  clave: string
  nombre: string
  usaTabulador: boolean
  orden: number
  activo: boolean
}

export const NOMBRE_TIPO_PAGO_MAX = 20

// Respaldo mientras carga el catálogo (o si falla): los tipos que existían
// fijos en Nueva Solicitud antes de que fueran configurables.
export const TIPOS_PAGO_DEFAULT: TipoPago[] = [
  { id: -1, clave: "Mensual",    nombre: "Mensual",    usaTabulador: true,  orden: 1, activo: true },
  { id: -2, clave: "Unico",      nombre: "Único",      usaTabulador: true,  orden: 2, activo: true },
  { id: -3, clave: "Por_hora",   nombre: "Por Hora",   usaTabulador: false, orden: 3, activo: true },
  { id: -4, clave: "Por_taller", nombre: "Por Taller", usaTabulador: false, orden: 4, activo: true },
  { id: -5, clave: "Por_dia",    nombre: "Por Día",    usaTabulador: false, orden: 5, activo: true },
]

/** "Por Evento" → "Por_Evento". Los PDFs muestran la clave con "_" → " ". */
export function claveDesdeNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, "_").slice(0, NOMBRE_TIPO_PAGO_MAX)
}

/** Nombre limpio para guardar: sin espacios de más. */
export function normalizarNombreTipoPago(v: unknown): string {
  return String(v ?? "").trim().replace(/\s+/g, " ")
}

export function mapTipoPago(r: { id: number; clave: string; nombre: string; usa_tabulador: boolean; orden: number; activo: boolean }): TipoPago {
  return { id: r.id, clave: r.clave, nombre: r.nombre, usaTabulador: r.usa_tabulador, orden: r.orden, activo: r.activo }
}

/** Si el tipo de pago no lleva "Equivalencia al Tabulador". Una clave que no
 *  está en el catálogo (ej. datos viejos) se trata como que sí la lleva. */
export function tipoPagoSinTabulador(tipos: TipoPago[], clave: string | undefined): boolean {
  const t = tipos.find((x) => x.clave === clave)
  return t ? !t.usaTabulador : false
}
