/**
 * Mensaje de error apto para devolver al cliente.
 *
 * Muchas rutas lanzan errores de negocio con un mensaje pensado para el
 * usuario (p. ej. los del WS de firma o de SIGeF) y el frontend lo muestra tal
 * cual, así que esos se conservan. Lo que se oculta son los errores internos:
 * los de Prisma/PostgreSQL (revelan tablas y columnas), los del SDK de S3
 * (bucket, llaves) y los del sistema/red o de programación — para esos se
 * devuelve el `fallback` genérico. El detalle completo sigue en console.error.
 */
export function mensajePublico(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  const x = e as Error & { code?: unknown; errno?: unknown; $metadata?: unknown; severity?: unknown }
  const code = String(x.code ?? "")
  const interno =
    /Prisma|DriverAdapter/i.test(e.name) ||
    /^P\d{4}$/.test(code) ||                 // códigos de Prisma
    x.severity !== undefined ||              // errores de pg
    x.$metadata !== undefined ||             // AWS SDK (S3)
    typeof x.errno === "number" ||           // errores de sistema (fs, red)
    /^E[A-Z_]+$/.test(code) ||               // ECONNREFUSED, ENOENT, ...
    ["TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(e.name)
  return interno ? fallback : e.message || fallback
}
