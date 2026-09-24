import { describe, it, expect, vi, beforeEach } from "vitest"

// Las rutas exigen sesión (lib/session.ts): se simula la del usuario de prueba.
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  requireSesion: vi.fn(async () => ({ id: "user-1", nombre: "Usuario Prueba", rol: "Administrador" })),
}))

vi.mock("@/lib/sse-manager", () => ({ broadcastUpdate: vi.fn() }))
vi.mock("@/lib/secretaria-scope", () => ({ getSecretariaScopeIds: vi.fn(async () => null) }))

type AnyFn = (...args: any[]) => any
const usuarioFindUnique     = vi.fn<AnyFn>(async () => ({ id: "user-1" }))
const solicitudFindUnique   = vi.fn<AnyFn>()
const solicitudUpdate       = vi.fn<AnyFn>(async () => ({}))
const historialCreate       = vi.fn<AnyFn>(async () => ({}))
const estadoFindFirst       = vi.fn<AnyFn>()
const estadoCreate          = vi.fn<AnyFn>()
const consecutivoUpsert     = vi.fn<AnyFn>(async () => ({ consecutivo: 1 }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario:            { findUnique: (...a: any[]) => (usuarioFindUnique as any)(...a) },
    solicitud:          { findUnique: (...a: any[]) => (solicitudFindUnique as any)(...a), update: (...a: any[]) => (solicitudUpdate as any)(...a) },
    historial_solicitud:{ create: (...a: any[]) => (historialCreate as any)(...a) },
    estado:             { findFirst: (...a: any[]) => (estadoFindFirst as any)(...a), create: (...a: any[]) => (estadoCreate as any)(...a) },
    consecutivo_folio:  { upsert: (...a: any[]) => (consecutivoUpsert as any)(...a) },
  },
}))

import { PATCH } from "./route"

function makeReq(body: any) {
  return { json: async () => body } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  usuarioFindUnique.mockResolvedValue({ id: "user-1" })
  solicitudUpdate.mockResolvedValue({})
  historialCreate.mockResolvedValue({})
  consecutivoUpsert.mockResolvedValue({ consecutivo: 1 })
  estadoFindFirst.mockImplementation(async ({ where }: any) => ({ id: 55, nombre: where.nombre.equals }))
})

describe("PATCH /api/validacion — Regla 11: UEFA no asigna folio de recepción", () => {
  it("al enviar a DGDO ('Pendiente DO') no incluye folio_recepcion en el update, aunque la solicitud sea normal", async () => {
    solicitudFindUnique.mockResolvedValue({
      id: 1, estado_id: 3, estado: { nombre: "En Validacion Justificaciones" },
      folio_recepcion: null, folio_justificacion: "JUST-2026-0001", es_extemporanea: false,
      usuario: null,
    })

    await PATCH(makeReq({ solicitudId: 1, nuevoEstado: "Pendiente DO", usuarioId: "user-1" }))

    expect(solicitudUpdate).toHaveBeenCalledTimes(1)
    expect(solicitudUpdate.mock.calls[0][0].data).not.toHaveProperty("folio_recepcion")
  })

  it("al enviar a DGDO tampoco asigna folio_recepcion cuando la solicitud es extemporánea", async () => {
    solicitudFindUnique.mockResolvedValue({
      id: 2, estado_id: 3, estado: { nombre: "En Validacion Justificaciones" },
      folio_recepcion: null, folio_justificacion: "JUST-2026-0002", es_extemporanea: true,
      usuario: null,
    })

    await PATCH(makeReq({ solicitudId: 2, nuevoEstado: "Pendiente DO", usuarioId: "user-1" }))

    expect(solicitudUpdate.mock.calls[0][0].data).not.toHaveProperty("folio_recepcion")
    // Tampoco debe tocar el consecutivo de folios de recepción (ni el normal ni el de extemporánea).
    expect(consecutivoUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_mes_anio: expect.objectContaining({ tipo: "FREC" }) } })
    )
    expect(consecutivoUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_mes_anio: expect.objectContaining({ tipo: "FREC_EXT" }) } })
    )
  })
})
