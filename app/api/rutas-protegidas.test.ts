import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "fs"
import { join, relative, sep } from "path"

/**
 * Candado contra regresiones: toda ruta de /api debe exigir sesión
 * (requireSesion / requireGestionUsuarios, ver lib/session.ts), salvo las
 * públicas de esta lista. Si agregas una ruta nueva y este test falla, protégela
 * o — solo si de verdad debe ser pública — agrégala aquí explicando por qué.
 */
const PUBLICAS: Record<string, string> = {
  "app/api/auth/route.ts": "login y recuperación de contraseña (valida sesión por acción)",
  "app/api/events/route.ts": "SSE: solo emite nombres de apartados a refrescar",
  "app/api/firma-efirma/link-info/route.ts": "firma externa: se valida con el token del enlace",
  "app/api/firma-efirma/acceder/route.ts": "firma externa: se valida con el token del enlace",
  "app/api/firma-efirma/firmar/route.ts": "firma externa: se valida con el token del enlace",
  "app/api/firma-efirma/pdf/route.ts": "firma externa: se valida con el token del enlace",
  "app/api/firma-efirma/descargar-firmado/route.ts": "firma externa: se valida con el token del enlace",
}

function rutas(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) rutas(p, out)
    else if (e.name === "route.ts") out.push(p)
  }
  return out
}

const root = process.cwd()
const todas = rutas(join(root, "app", "api")).map((p) => relative(root, p).split(sep).join("/"))

describe("rutas de /api protegidas con sesión", () => {
  it("encuentra rutas", () => {
    expect(todas.length).toBeGreaterThan(50)
  })

  for (const ruta of todas.filter((r) => !(r in PUBLICAS))) {
    it(`${ruta} exige sesión en cada handler`, () => {
      const src = readFileSync(join(root, ruta), "utf8")
      const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? []
      const guardas = src.match(/await (requireSesion|requireGestionUsuarios)\(\)/g) ?? []
      expect(handlers.length).toBeGreaterThan(0)
      expect(guardas.length).toBeGreaterThanOrEqual(handlers.length)
    })
  }
})

/**
 * Escrituras de configuración: además de sesión exigen permiso de la pantalla
 * (requireMenu / requireCatalogoAdmin / puedeGestionarUsuarios, ver lib/api-guard.ts).
 */
const ESCRITURAS_CON_PERMISO: Record<string, RegExp> = {
  "app/api/calendario/route.ts": /requireMenu\(/,
  "app/api/configuracion/nota-dictamen/route.ts": /requireMenu\(/,
  "app/api/tabulador/route.ts": /requireMenu\(/,
  "app/api/tabulador/[id]/route.ts": /requireMenu\(/,
  "app/api/catalogo/centralizada/route.ts": /requireMenu\(/,
  "app/api/catalogo/centralizada/[id]/route.ts": /requireMenu\(/,
  "app/api/catalogo/centralizada/import/route.ts": /requireMenu\(/,
  "app/api/catalogo/paraestatal/categorias/route.ts": /requireMenu\(/,
  "app/api/catalogo/paraestatal/categorias/[id]/route.ts": /requireMenu\(/,
  "app/api/catalogo/paraestatal/organos/route.ts": /requireMenu\(/,
  "app/api/catalogo/paraestatal/organos/[id]/route.ts": /requireMenu\(/,
  "app/api/catalogo/paraestatal/import/route.ts": /requireMenu\(/,
  "app/api/catalogo-justificaciones/sincronizar/route.ts": /requireCatalogoAdmin\(/,
  "app/api/permisos-captura/route.ts": /puedeGestionarUsuarios\(/,
  "app/api/permisos-captura/[id]/route.ts": /puedeGestionarUsuarios\(/,
}

describe("escrituras de configuración exigen permiso de pantalla", () => {
  for (const [ruta, guarda] of Object.entries(ESCRITURAS_CON_PERMISO)) {
    it(`${ruta} verifica permiso en cada escritura`, () => {
      const src = readFileSync(join(root, ruta), "utf8")
      const escrituras = src.match(/export async function (POST|PUT|PATCH|DELETE)\b/g) ?? []
      const guardas = src.match(new RegExp(guarda.source, "g")) ?? []
      expect(escrituras.length).toBeGreaterThan(0)
      expect(guardas.length).toBeGreaterThanOrEqual(escrituras.length)
    })
  }
})
