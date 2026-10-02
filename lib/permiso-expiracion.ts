// Todos los permisos de captura (Habilitar Captura, Capturar en Nuevo
// Ejercicio, Capturar en Catálogo, Capturar en Nueva Solicitud) valen solo
// 3 días naturales desde que se otorgan. Pasado ese tiempo dejan de servir y
// ya no se muestran como activos.

export const DIAS_VIGENCIA_PERMISO = 3
const MS_VIGENCIA = DIAS_VIGENCIA_PERMISO * 24 * 60 * 60 * 1000

/** Fecha y hora en que vence un permiso otorgado en `otorgado`. */
export function venceEnPermiso(otorgado: Date): Date {
  return new Date(otorgado.getTime() + MS_VIGENCIA)
}

/** Los permisos otorgados antes de esta fecha ya vencieron (para filtros de BD). */
export function otorgadoMinimoVigente(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - MS_VIGENCIA)
}

export function permisoVencido(otorgado: Date, ahora: Date = new Date()): boolean {
  return venceEnPermiso(otorgado).getTime() <= ahora.getTime()
}

/** "AAAA-MM-DD HH:mm" en hora de México (el servidor puede correr en UTC). */
export function fechaHoraMx(d: Date): string {
  return d.toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).slice(0, 16)
}
