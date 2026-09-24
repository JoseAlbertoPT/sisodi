import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"

vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: vi.fn(async () => ({})) }) } }))
vi.mock("@/lib/api-guard", () => ({
  puedeAdministrarCatalogo: vi.fn(async () => false),
  puedeConsultarCatalogo: vi.fn(async () => true),
}))
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  iniciarSesion: vi.fn(async () => {}),
  cerrarSesionesDeUsuario: vi.fn(async () => {}),
}))

const usuarioFindUnique = vi.fn()
const usuarioUpdate     = vi.fn(async ({ data }: any) => ({ ...data }))
const usuarioUpdateMany = vi.fn()
const codigoFindFirst   = vi.fn()
const codigoUpdate      = vi.fn(async () => ({}))
const codigoDeleteMany  = vi.fn(async () => ({}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: (...a: any[]) => (usuarioFindUnique as any)(...a),
      update:     (...a: any[]) => (usuarioUpdate as any)(...a),
      updateMany: (...a: any[]) => (usuarioUpdateMany as any)(...a),
    },
    codigo_recuperacion: {
      findFirst:  (...a: any[]) => (codigoFindFirst as any)(...a),
      update:     (...a: any[]) => (codigoUpdate as any)(...a),
      deleteMany: (...a: any[]) => (codigoDeleteMany as any)(...a),
    },
  },
}))

import { POST } from "./route"
import { hashToken } from "@/lib/session"

function req(action: string, body: any) {
  return {
    json: async () => body,
    nextUrl: new URL(`http://localhost/api/auth?action=${action}`),
    headers: new Headers(),
  } as any
}

const HASH_ACTUAL = bcrypt.hashSync("Actual#2026", 4)

function usuarioBase(over: Record<string, any> = {}) {
  return {
    id: "u-1", rfc: "ABCD850101XYZ", nombre: "Prueba", correo: "p@x.mx", activo: true,
    password_hash: HASH_ACTUAL, intentos_fallidos: 0, nivel_bloqueo: 0, bloqueado_hasta: null,
    must_change_password: false, rol: { nombre: "Revisor" }, area: null, organo_centralizado: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  usuarioFindUnique.mockResolvedValue(usuarioBase())
})

const cambiosDePassword = () => usuarioUpdate.mock.calls.filter((c: any) => c[0]?.data?.password_hash)

describe("POST /api/auth?action=change-password", () => {
  it("rechaza si no viene la contraseña actual (antes bastaba el RFC)", async () => {
    const res = await POST(req("change-password", { rfc: "ABCD850101XYZ", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(400)
    expect(cambiosDePassword()).toHaveLength(0)
  })

  it("rechaza con la contraseña actual incorrecta y no cambia nada", async () => {
    const res = await POST(req("change-password", { rfc: "ABCD850101XYZ", passwordActual: "otra", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(401)
    expect(cambiosDePassword()).toHaveLength(0)
  })

  it("cambia la contraseña con la actual correcta", async () => {
    const res = await POST(req("change-password", { rfc: "ABCD850101XYZ", passwordActual: "Actual#2026", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(200)
    expect(cambiosDePassword()).toHaveLength(1)
  })
})

describe("POST /api/auth?action=recuperar-reset", () => {
  it("rechaza sin el token que prueba que el código se validó", async () => {
    const res = await POST(req("recuperar-reset", { rfc: "ABCD850101XYZ", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(400)
    expect(cambiosDePassword()).toHaveLength(0)
  })

  it("rechaza un token inválido o vencido", async () => {
    codigoFindFirst.mockResolvedValue(null)
    const res = await POST(req("recuperar-reset", { rfc: "ABCD850101XYZ", resetToken: "inventado", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(400)
    expect(cambiosDePassword()).toHaveLength(0)
  })

  it("restablece con un token válido", async () => {
    codigoFindFirst.mockResolvedValue({ usuario_id: "u-1" })
    const res = await POST(req("recuperar-reset", { rfc: "ABCD850101XYZ", resetToken: "tok", nuevaPassword: "Nueva#2026x" }))
    expect(res.status).toBe(200)
    expect(codigoFindFirst.mock.calls[0][0].where.reset_token_hash).toBe(hashToken("tok"))
    expect(cambiosDePassword()).toHaveLength(1)
  })
})

describe("POST /api/auth?action=recuperar-codigo", () => {
  const registro = (over: Record<string, any> = {}) => ({
    id: 7, codigo: "123456", intentos: 0, usado: false, expira_en: new Date(Date.now() + 60_000), ...over,
  })

  it("código correcto: devuelve un resetToken de un solo uso", async () => {
    codigoFindFirst.mockResolvedValue(registro())
    const res = await POST(req("recuperar-codigo", { rfc: "ABCD850101XYZ", codigo: "123456" }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(typeof json.resetToken).toBe("string")
    expect((codigoUpdate.mock.calls[0] as any)[0].data.reset_token_hash).toBe(hashToken(json.resetToken))
  })

  it("código incorrecto: suma un intento", async () => {
    codigoFindFirst.mockResolvedValue(registro())
    const res = await POST(req("recuperar-codigo", { rfc: "ABCD850101XYZ", codigo: "000000" }))
    expect(res.status).toBe(400)
    expect((codigoUpdate.mock.calls[0] as any)[0].data.intentos).toBe(1)
  })

  it("al agotar los intentos invalida el código", async () => {
    codigoFindFirst.mockResolvedValue(registro({ intentos: 4 }))
    const res = await POST(req("recuperar-codigo", { rfc: "ABCD850101XYZ", codigo: "000000" }))
    expect(res.status).toBe(400)
    expect((codigoUpdate.mock.calls[0] as any)[0].data.usado).toBe(true)
  })
})

describe("POST /api/auth?action=login", () => {
  it("no inicia sesión si el usuario debe cambiar su contraseña", async () => {
    const { iniciarSesion } = await import("@/lib/session")
    usuarioFindUnique.mockResolvedValue(usuarioBase({ must_change_password: true }))
    const res = await POST(req("login", { rfc: "ABCD850101XYZ", password: "Actual#2026" }))
    expect(res.status).toBe(200)
    expect(iniciarSesion).not.toHaveBeenCalled()
  })

  it("inicia sesión con credenciales correctas", async () => {
    const { iniciarSesion } = await import("@/lib/session")
    const res = await POST(req("login", { rfc: "ABCD850101XYZ", password: "Actual#2026" }))
    expect(res.status).toBe(200)
    expect(iniciarSesion).toHaveBeenCalledTimes(1)
  })
})
