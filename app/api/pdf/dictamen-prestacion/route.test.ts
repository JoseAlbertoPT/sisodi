import { describe, it, expect, vi, beforeEach } from "vitest"

const solicitudFindUnique          = vi.fn()
const catalogoJustFindUnique       = vi.fn(async () => null)
const catalogoSolicitudCount       = vi.fn(async () => 0)
const configuracionTextoFindUnique = vi.fn(async () => null)

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitud:              { findUnique: (...a: any[]) => (solicitudFindUnique as any)(...a) },
    catalogo_justificacion: { findUnique: (...a: any[]) => (catalogoJustFindUnique as any)(...a) },
    catalogo_solicitud:     { count: (...a: any[]) => (catalogoSolicitudCount as any)(...a) },
    configuracion_texto:    { findUnique: (...a: any[]) => (configuracionTextoFindUnique as any)(...a) },
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
  configuracionTextoFindUnique.mockResolvedValue(null)
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
