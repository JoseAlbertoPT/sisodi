// Permiso "Capturar solicitud" del año siguiente: un usuario con este permiso
// puede capturar una solicitud del ejercicio siguiente para el régimen
// autorizado, sin elegir mes ni quincena. Es de un solo uso; el administrador
// decide cuándo otorgarlo (pensado para capturar en diciembre).
//
// Se guarda en permiso_captura (igual que las capturas extemporáneas por
// periodo) con un periodo especial "Ejercicio AAAA", para no necesitar otra
// tabla y que el resto (revocar, consumir, tiempo real) funcione igual.

export function periodoAnioSiguiente(anio: number): string {
  return `Ejercicio ${anio}`
}

export function esPeriodoAnioSiguiente(periodo: string): boolean {
  return /^Ejercicio \d{4}$/.test(periodo)
}
