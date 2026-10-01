import { describe, it, expect, vi, beforeEach } from "vitest"

// Las rutas exigen sesión (lib/session.ts): se simula la del usuario de prueba.
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  requireSesion: vi.fn(async () => ({ id: "user-1", nombre: "Usuario Prueba", rol: "Administrador" })),
}))

const solicitudFindUnique          = vi.fn()
const catalogoJustFindUnique       = vi.fn(async (): Promise<{ id: number } | null> => null)
const catalogoSolicitudCount       = vi.fn(async () => 0)
const catalogoSolicitudFindFirst   = vi.fn(async (): Promise<{ folio: string | null } | null> => null)
const configuracionTextoFindMany = vi.fn(async () => [] as any[])

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitud:              { findUnique: (...a: any[]) => (solicitudFindUnique as any)(...a) },
    catalogo_justificacion: { findUnique: (...a: any[]) => (catalogoJustFindUnique as any)(...a) },
    catalogo_solicitud:     {
      count:     (...a: any[]) => (catalogoSolicitudCount as any)(...a),
      findFirst: (...a: any[]) => (catalogoSolicitudFindFirst as any)(...a),
    },
    configuracion_texto:    { findMany: (...a: any[]) => (configuracionTextoFindMany as any)(...a) },
  },
}))

vi.mock("@react-pdf/renderer", () => ({
  renderToStream: vi.fn(async function* (element: any) {
    lastPlantillaData = element?.props?.data ?? null
    yield Buffer.from("fake-pdf-bytes")
  }),
}))

let lastPlantillaData: any = null
vi.mock("@/components/plantillas/PlantillaDictamenPrestacionServicios", () => ({
  PlantillaDictamenPrestacionServicios: (props: any) => null,
}))

import { GET } from "./route"

function makeReq(url: string) {
  return { url } as any
}

function baseSolicitud(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    dictamen: null,
    estado: { nombre: "Pendiente Firma Dictamen" },
    historial_solicitud: [],
    folio_dictamen: "05/08/2026",
    folio_recepcion: "AG-010-2026",
    secretaria: "Sec. de Finanzas",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  lastPlantillaData = null
  catalogoJustFindUnique.mockResolvedValue(null)
  catalogoSolicitudCount.mockResolvedValue(0)
  catalogoSolicitudFindFirst.mockResolvedValue(null)
  configuracionTextoFindMany.mockResolvedValue([])
})

describe("GET /api/pdf/dictamen-prestacion — Regla 12: bloqueado hasta la última firma", () => {
  it("responde 403 y no genera el PDF si el estado no es 'Emitido'", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ estado: { nombre: "Pendiente Firma Dictamen" } }))

    const res  = await GET(makeReq("http://localhost/api/pdf/dictamen-prestacion?id=1"))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.ok).toBe(false)
    expect(lastPlantillaData).toBeNull()
  })

  it("genera el PDF con el folio visible una vez que el estado es 'Emitido'", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ estado: { nombre: "Emitido" } }))

    const res = await GET(makeReq("http://localhost/api/pdf/dictamen-prestacion?id=1"))

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(lastPlantillaData).not.toBeNull()
    expect(lastPlantillaData.folio).toContain("05/08/2026")
  })
})

describe("GET /api/pdf/dictamen-prestacion — sufijo de reutilización: solo en \"Folio\", nunca en \"Justificación\"", () => {
  it("descarga normal: ni 'Folio' ni 'Justificación' llevan sufijo, aunque el registro ya se haya reutilizado antes", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ estado: { nombre: "Emitido" }, secretaria: "Secretaría de Finanzas" }))
    catalogoJustFindUnique.mockResolvedValue({ id: 5 })
    catalogoSolicitudCount.mockResolvedValue(2)

    const res = await GET(makeReq("http://localhost/api/pdf/dictamen-prestacion?id=1"))

    expect(res.status).toBe(200)
    expect(lastPlantillaData.folio).toBe("05/08/2026")
    expect(lastPlantillaData.folioActual).toBeUndefined()
    expect(lastPlantillaData.justificacion).not.toContain("-2")
    expect(catalogoSolicitudCount).not.toHaveBeenCalled()
  })

  it("al reutilizar desde Catálogo (con vigencia override): 'Folio de origen' limpio, 'Folio actual' con sufijo, 'Justificación' limpia", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ estado: { nombre: "Emitido" }, secretaria: "Secretaría de Finanzas" }))
    catalogoJustFindUnique.mockResolvedValue({ id: 5 })
    catalogoSolicitudCount.mockResolvedValue(2)

    const res = await GET(makeReq(
      "http://localhost/api/pdf/dictamen-prestacion?id=1&vigenciaInicio=2026-08-20&vigenciaFin=2026-12-31",
    ))

    expect(res.status).toBe(200)
    expect(lastPlantillaData.folio).toBe("05/08/2026")
    expect(lastPlantillaData.folioActual).toBe("05/08/2026-2")
    expect(lastPlantillaData.justificacion).not.toContain("-2")
  })
})

describe("GET /api/pdf/dictamen-prestacion — folio actual NN/MM/AAAA-CH|CA de la reutilización", () => {
  it("usa el folio guardado en la reutilización como 'Folio actual' y en el nombre del archivo, sin sufijo -N", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ estado: { nombre: "Emitido" }, secretaria: "Secretaría de Finanzas" }))
    catalogoJustFindUnique.mockResolvedValue({ id: 5 })
    catalogoSolicitudFindFirst.mockResolvedValue({ folio: "01/09/2026-CH" })
    catalogoSolicitudCount.mockResolvedValue(3)

    const res = await GET(makeReq(
      "http://localhost/api/pdf/dictamen-prestacion?id=1&vigenciaInicio=2026-09-20&vigenciaFin=2026-12-31",
    ))

    expect(res.status).toBe(200)
    expect(lastPlantillaData.folio).toBe("05/08/2026")
    expect(lastPlantillaData.folioActual).toBe("01/09/2026-CH")
    expect(lastPlantillaData.justificacion).not.toContain("-CH")
    expect(res.headers.get("Content-Disposition")).toContain("Dictamen_01-09-2026-CH.pdf")
    expect(catalogoSolicitudCount).not.toHaveBeenCalled()
  })
})
