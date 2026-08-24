import { describe, it, expect } from "vitest"
import {
  calcularVigenciaMaxima,
  esInicioSinRangoValido,
  validarVigencia,
  parseFechaLocal,
  MENSAJE_INICIO_31_DIC,
} from "./vigencia"

function d(y: number, m: number, day: number) {
  return new Date(y, m - 1, day)
}

describe("calcularVigenciaMaxima", () => {
  it("inicio a principios de año: máxima = inicio + 6 meses (dentro del año)", () => {
    expect(calcularVigenciaMaxima(d(2026, 1, 15))).toEqual(d(2026, 7, 15))
  })

  it("ejemplo dado: 20 de agosto -> 31 de diciembre", () => {
    expect(calcularVigenciaMaxima(d(2026, 8, 20))).toEqual(d(2026, 12, 31))
  })

  it("ejemplo dado: 15 de marzo -> 15 de septiembre", () => {
    expect(calcularVigenciaMaxima(d(2026, 3, 15))).toEqual(d(2026, 9, 15))
  })

  it("frontera: 1 de julio -> 31 de diciembre (porque +6 meses cae en enero del año siguiente)", () => {
    expect(calcularVigenciaMaxima(d(2026, 7, 1))).toEqual(d(2026, 12, 31))
  })

  it("año bisiesto: 29 de febrero -> 29 de agosto del mismo año", () => {
    expect(calcularVigenciaMaxima(d(2028, 2, 29))).toEqual(d(2028, 8, 29))
  })

  it("regresión del bug de Date.setMonth: 31 de mayo -> 30 de noviembre (no 1 de diciembre)", () => {
    expect(calcularVigenciaMaxima(d(2026, 5, 31))).toEqual(d(2026, 11, 30))
  })
})

describe("esInicioSinRangoValido", () => {
  it("true para el 31 de diciembre", () => {
    expect(esInicioSinRangoValido(d(2026, 12, 31))).toBe(true)
  })

  it("false para cualquier otra fecha", () => {
    expect(esInicioSinRangoValido(d(2026, 12, 30))).toBe(false)
    expect(esInicioSinRangoValido(d(2026, 1, 1))).toBe(false)
  })
})

describe("validarVigencia", () => {
  it("válido: fin exactamente en la máxima permitida", () => {
    expect(validarVigencia(d(2026, 8, 20), d(2026, 12, 31))).toEqual({ ok: true })
  })

  it("inválido: inicio el 31 de diciembre", () => {
    const r = validarVigencia(d(2026, 12, 31), d(2026, 12, 31))
    expect(r.ok).toBe(false)
    expect(r.error).toBe(MENSAJE_INICIO_31_DIC)
  })

  it("inválido: fin anterior a inicio", () => {
    const r = validarVigencia(d(2026, 8, 20), d(2026, 8, 1))
    expect(r.ok).toBe(false)
  })

  it("inválido: fin después de la máxima permitida", () => {
    const r = validarVigencia(d(2026, 8, 20), d(2027, 1, 1))
    expect(r.ok).toBe(false)
  })

  it("válido: inicio anterior a hoy (permitido a nivel de módulo; la UX lo restringe aparte)", () => {
    const r = validarVigencia(d(2020, 1, 1), d(2020, 6, 30))
    expect(r.ok).toBe(true)
  })
})

describe("parseFechaLocal", () => {
  it("regresión: '2026-01-01' no debe correrse a 31 de diciembre en timezones detrás de UTC", () => {
    const parsed = parseFechaLocal("2026-01-01")
    expect(parsed).toEqual(d(2026, 1, 1))
    expect(esInicioSinRangoValido(parsed!)).toBe(false)
  })

  it("caso real: honorarios extemporáneo enero 1 a junio 24 debe validar sin error", () => {
    const inicio = parseFechaLocal("2026-01-01")!
    const fin = parseFechaLocal("2026-06-24")!
    expect(validarVigencia(inicio, fin)).toEqual({ ok: true })
  })
})
