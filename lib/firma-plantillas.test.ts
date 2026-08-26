import { describe, it, expect, vi } from "vitest"

const historialFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    historial_solicitud: { findMany: (...a: any[]) => (historialFindMany as any)(...a) },
  },
}))

import { resolverUsuariosInternos } from "./firma-plantillas"

function h(estadoNuevoNombre: string, usuario_id: string) {
  return { usuario_id, estado_historial_solicitud_estado_nuevo_idToestado: { nombre: estadoNuevoNombre } }
}

describe("resolverUsuariosInternos", () => {
  it("usa la última transición a cada estado, no la primera (caso de reasignación tras observación)", async () => {
    historialFindMany.mockResolvedValue([
      h("En Verificacion Final", "user-A"),
      h("Observado por Verificacion Final", "user-verificador"),
      h("En Revision Revisor", "user-verificador"),
      h("En Verificacion Final", "user-B"),
      h("En Revision Emisor", "user-C"),
      h("Emitido", "user-D"),
    ])

    const result = await resolverUsuariosInternos(1)

    expect(result.revisor_id).toBe("user-B")
    expect(result.validador_id).toBe("user-C")
    expect(result.emisor_id).toBe("user-D")
  })

  it("devuelve null cuando no hay ninguna transición a ese estado", async () => {
    historialFindMany.mockResolvedValue([])
    const result = await resolverUsuariosInternos(1)
    expect(result).toEqual({ revisor_id: null, validador_id: null, emisor_id: null })
  })
})
