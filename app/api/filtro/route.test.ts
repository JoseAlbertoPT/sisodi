import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/sse-manager", () => ({ broadcastUpdate: vi.fn() }))
vi.mock("@/lib/secretaria-scope", () => ({ getSecretariaScopeIds: vi.fn(async () => null) }))

const consecutivoUpsert = vi.fn()
const estadoFindFirst   = vi.fn()
const estadoCreate      = vi.fn()
const solicitudFindUnique = vi.fn()
const solicitudUpdate     = vi.fn()
const historialCreate     = vi.fn()
const usuarioFindUnique   = vi.fn(async () => ({ id: "user-1" }))
const dictamenFindUnique  = vi.fn()
const catalogoFindUnique  = vi.fn(async () => null)
const catalogoCreate      = vi.fn(async () => ({}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario:              { findUnique: (...a: any[]) => (usuarioFindUnique as any)(...a) },
    solicitud:            {
      findUnique: (...a: any[]) => (solicitudFindUnique as any)(...a),
      update:     (...a: any[]) => (solicitudUpdate as any)(...a),
    },
    estado:                { findFirst: (...a: any[]) => (estadoFindFirst as any)(...a), create: (...a: any[]) => (estadoCreate as any)(...a) },
    historial_solicitud:   { create: (...a: any[]) => (historialCreate as any)(...a) },
    consecutivo_folio:     { upsert: (...a: any[]) => (consecutivoUpsert as any)(...a) },
    dictamen:              { findUnique: (...a: any[]) => (dictamenFindUnique as any)(...a), create: vi.fn(), update: vi.fn() },
    catalogo_justificacion:{ findUnique: (...a: any[]) => (catalogoFindUnique as any)(...a), create: (...a: any[]) => (catalogoCreate as any)(...a) },
  },
}))

import { PATCH } from "./route"

function makeReq(body: any) {
  return { json: async () => body } as any
}

function baseSolicitud(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    estado_id: 10,
    estado: { id: 10, nombre: "En Revision Revisor" },
    dictamen: null,
    historial_solicitud: [],
    folio_recepcion: null,
    folio_dictamen: null,
    modalidad_firma: null,
    es_extemporanea: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  usuarioFindUnique.mockResolvedValue({ id: "user-1" })
  solicitudUpdate.mockImplementation(async ({ data }: any) => ({ id: 1, ...data }))
  historialCreate.mockResolvedValue({})
  estadoFindFirst.mockImplementation(async ({ where }: any) => ({ id: 99, nombre: where.nombre.equals }))
  catalogoFindUnique.mockResolvedValue(null)
})

describe("PATCH /api/filtro — Tarea 11: folio de recepción al aprobar (filtro 1)", () => {
  it("caso normal: autogenera el folio de recepción al aprobar (no existía antes)", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ es_extemporanea: false, folio_recepcion: null }))
    consecutivoUpsert.mockResolvedValue({ consecutivo: 5 })

    const res  = await PATCH(makeReq({ solicitudId: 1, accion: "aprobar", filtro: 1, usuarioId: "user-1" }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(consecutivoUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_mes_anio: expect.objectContaining({ tipo: "FREC" }) } })
    )
    const updateCall = solicitudUpdate.mock.calls.find((c: any[]) => c[0].data.estado_id !== undefined)
    expect(updateCall).toBeDefined()
    expect(updateCall![0].data.folio_recepcion).toMatch(/^[A-Z]{2}-005-\d{4}$/)
    expect(json.folioRecepcion).toMatch(/^[A-Z]{2}-005-\d{4}$/)
  })

  it("caso excepción: sin folioRecepcion en el body responde 400 y no autogenera", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ es_extemporanea: true, folio_recepcion: null }))

    const res = await PATCH(makeReq({ solicitudId: 1, accion: "aprobar", filtro: 1, usuarioId: "user-1" }))
    expect(res.status).toBe(400)
    expect(consecutivoUpsert).not.toHaveBeenCalled()
    expect(solicitudUpdate).not.toHaveBeenCalled()
  })

  it("caso excepción: folioRecepcion con formato inválido responde 400", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ es_extemporanea: true, folio_recepcion: null }))

    const res = await PATCH(makeReq({
      solicitudId: 1, accion: "aprobar", filtro: 1, usuarioId: "user-1", folioRecepcion: "no-es-un-folio",
    }))
    expect(res.status).toBe(400)
    expect(solicitudUpdate).not.toHaveBeenCalled()
  })

  it("caso excepción: folioRecepcion válido se persiste tal cual, sin autogenerar", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ es_extemporanea: true, folio_recepcion: null }))

    const res  = await PATCH(makeReq({
      solicitudId: 1, accion: "aprobar", filtro: 1, usuarioId: "user-1", folioRecepcion: "MY-001-2026",
    }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(consecutivoUpsert).not.toHaveBeenCalled()
    const updateCall = solicitudUpdate.mock.calls[0]
    expect(updateCall[0].data.folio_recepcion).toBe("MY-001-2026")
  })

  it("observar nunca asigna folio de recepción", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({ es_extemporanea: false, folio_recepcion: null }))

    await PATCH(makeReq({ solicitudId: 1, accion: "observar", filtro: 1, usuarioId: "user-1", observaciones: "falta algo" }))

    expect(consecutivoUpsert).not.toHaveBeenCalled()
    const updateCall = solicitudUpdate.mock.calls[0]
    expect(updateCall[0].data.folio_recepcion).toBeUndefined()
  })
})

describe("PATCH /api/filtro — Tarea 12: folio de dictamen al aprobar + elegir modalidad (filtro 3)", () => {
  it("primera aprobación de Emisión: genera folio de dictamen junto con la modalidad", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({
      estado: { id: 10, nombre: "En Revision Emisor" },
      modalidad_firma: null,
      folio_dictamen: null,
    }))
    consecutivoUpsert.mockResolvedValue({ consecutivo: 7 })

    const res  = await PATCH(makeReq({
      solicitudId: 1, accion: "aprobar", filtro: 3, usuarioId: "user-1", modalidadFirma: "autografa",
    }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(consecutivoUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_mes_anio: expect.objectContaining({ tipo: "FDICT" } as any) } })
    )
    const updateCall = solicitudUpdate.mock.calls[0]
    expect(updateCall[0].data.folio_dictamen).toMatch(/^07\/\d{2}\/\d{4}$/)
    expect(updateCall[0].data.modalidad_firma).toBe("autografa")
  })

  it("segunda aprobación (ya tenía modalidad guardada): no regenera el folio de dictamen", async () => {
    solicitudFindUnique.mockResolvedValue(baseSolicitud({
      estado: { id: 10, nombre: "En Revision Emisor" },
      modalidad_firma: "autografa",
      folio_dictamen: "07/08/2026",
    }))

    await PATCH(makeReq({
      solicitudId: 1, accion: "aprobar", filtro: 3, usuarioId: "user-1", modalidadFirma: "autografa",
    }))

    expect(consecutivoUpsert).not.toHaveBeenCalled()
    const updateCall = solicitudUpdate.mock.calls[0]
    expect(updateCall[0].data.folio_dictamen).toBeUndefined()
  })
})
