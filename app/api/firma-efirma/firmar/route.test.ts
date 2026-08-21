import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.mock("@/lib/sse-manager", () => ({ broadcastUpdate: vi.fn() }))

type AnyFn = (...args: any[]) => any
const firmanteFindUnique  = vi.fn<AnyFn>()
const firmaFirmanteUpdate = vi.fn<AnyFn>(async () => ({}))
const firmaFirmanteCount  = vi.fn<AnyFn>()
const firmaProcesoUpdate  = vi.fn<AnyFn>(async () => ({}))
const estadoFindFirst     = vi.fn<AnyFn>()
const solicitudFindUnique = vi.fn<AnyFn>()
const solicitudUpdate     = vi.fn<AnyFn>(async () => ({}))
const historialCreate     = vi.fn<AnyFn>(async () => ({}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    firma_firmante: {
      findUnique: (...a: any[]) => (firmanteFindUnique as any)(...a),
      update:     (...a: any[]) => (firmaFirmanteUpdate as any)(...a),
      count:      (...a: any[]) => (firmaFirmanteCount as any)(...a),
    },
    firma_proceso: { update: (...a: any[]) => (firmaProcesoUpdate as any)(...a) },
    estado:        { findFirst: (...a: any[]) => (estadoFindFirst as any)(...a) },
    solicitud:     { findUnique: (...a: any[]) => (solicitudFindUnique as any)(...a), update: (...a: any[]) => (solicitudUpdate as any)(...a) },
    historial_solicitud: { create: (...a: any[]) => (historialCreate as any)(...a) },
    $transaction: async (arg: any) => {
      if (typeof arg === "function") return arg(mockTx)
      return Promise.all(arg)
    },
  },
}))

const mockTx = {
  firma_firmante: { update: (...a: any[]) => (firmaFirmanteUpdate as any)(...a), count: (...a: any[]) => (firmaFirmanteCount as any)(...a) },
  firma_proceso:  { update: (...a: any[]) => (firmaProcesoUpdate as any)(...a) },
}

process.env.EFIRMA_BYPASS = "true"
let POST: typeof import("./route").POST
beforeAll(async () => {
  ;({ POST } = await import("./route"))
})

function makeReq(body: any) {
  return { json: async () => body, cookies: { get: () => undefined } } as any
}

// Plantilla "Prestación de Servicios": 1 externo (orden 1) -> uefa interno (orden 2).
function firmantesPrestacion() {
  return [
    { id: 1, orden: 1, rol: "Elaboró", tipo: "externo", bandeja: null, firmado: true },
    { id: 2, orden: 2, rol: "Revisó",  tipo: "interno",  bandeja: "uefa", firmado: false },
  ]
}

// Plantilla "Nombramiento": 2 externos (orden 1-2) -> uefa (orden 3) -> revision (orden 4).
function firmantesNombramiento({ uefaFirmado }: { uefaFirmado: boolean }) {
  return [
    { id: 1, orden: 1, rol: "Vo. Bo.",  tipo: "externo", bandeja: null,       firmado: true },
    { id: 2, orden: 2, rol: "Elaboró",  tipo: "externo", bandeja: null,       firmado: true },
    { id: 3, orden: 3, rol: "Revisó",   tipo: "interno",  bandeja: "uefa",     firmado: uefaFirmado },
    { id: 4, orden: 4, rol: "Revisó",   tipo: "interno",  bandeja: "revision", firmado: false },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  firmaFirmanteUpdate.mockResolvedValue({})
  firmaProcesoUpdate.mockResolvedValue({})
  solicitudUpdate.mockResolvedValue({})
  historialCreate.mockResolvedValue({})
  estadoFindFirst.mockImplementation(async ({ where }: any) => ({ id: 77, nombre: where.nombre.equals }))
  solicitudFindUnique.mockResolvedValue({ estado_id: 5 })
})

describe("POST /api/firma-efirma/firmar — Regla: no bloquea a UEFA después de la firma externa", () => {
  it("tras firmar el externo, avanza el estado de la solicitud a la bandeja del siguiente interno pendiente (uefa) y registra el historial", async () => {
    const firmantes = firmantesPrestacion()
    firmanteFindUnique.mockResolvedValue({
      id: 1, orden: 1, rol: "Elaboró", tipo: "externo", firmado: false,
      expira_en: null, session_id: null,
      firma_proceso: {
        uuid: "u1", proceso_id: "proc-1", solicitud_id: 42, creado_por_id: "creador-uuid",
        total_firmantes: 2, firmantes,
      },
    })
    firmaFirmanteCount.mockResolvedValue(1)

    const res  = await POST(makeReq({
      uuid: "u1", token: "t1", usuario: "AAAA850101XXX", nombre: "Externo Uno", cargoFirmante: "Titular",
    }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(solicitudUpdate).toHaveBeenCalledTimes(1)
    expect(solicitudUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 42 },
      data:  { estado_id: 77 },
    })
    expect(estadoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombre: { equals: "Pendiente Firma Justificacion", mode: "insensitive" } } })
    )
    expect(historialCreate).toHaveBeenCalledTimes(1)
    expect(historialCreate.mock.calls[0][0].data).toMatchObject({
      solicitud_id: 42,
      usuario_id: "creador-uuid",
      estado_nuevo_id: 77,
    })
  })

  it("si UEFA ya firmó (reingreso/edge case), apunta al siguiente interno pendiente por orden en vez de UEFA de nuevo", async () => {
    const firmantes = firmantesNombramiento({ uefaFirmado: true })
    firmanteFindUnique.mockResolvedValue({
      id: 2, orden: 2, rol: "Elaboró", tipo: "externo", firmado: false,
      expira_en: null, session_id: null,
      firma_proceso: {
        uuid: "u2", proceso_id: "proc-2", solicitud_id: 99, creado_por_id: "creador-uuid",
        total_firmantes: 4, firmantes,
      },
    })
    firmaFirmanteCount.mockResolvedValue(3)

    await POST(makeReq({
      uuid: "u2", token: "t2", usuario: "BBBB850101XXX", nombre: "Externo Dos", cargoFirmante: "Titular",
    }))

    expect(solicitudUpdate.mock.calls[0][0].data.estado_id).toBe(77)
    expect(estadoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombre: { equals: "Pendiente Firma Revision", mode: "insensitive" } } })
    )
  })

  it("no avanza el estado cuando la firma completa el proceso (último firmante)", async () => {
    const firmantes = [
      { id: 1, orden: 1, rol: "Elaboró", tipo: "externo", bandeja: null, firmado: false },
    ]
    firmanteFindUnique.mockResolvedValue({
      id: 1, orden: 1, rol: "Elaboró", tipo: "externo", firmado: false,
      expira_en: null, session_id: null,
      firma_proceso: {
        uuid: "u3", proceso_id: "proc-3", solicitud_id: 7, creado_por_id: "creador-uuid",
        total_firmantes: 1, firmantes,
      },
    })
    firmaFirmanteCount.mockResolvedValue(1)

    const res  = await POST(makeReq({
      uuid: "u3", token: "t3", usuario: "CCCC850101XXX", nombre: "Externo Único", cargoFirmante: "Titular",
    }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.estado).toBe("completado")
    expect(solicitudUpdate).not.toHaveBeenCalled()
  })
})
