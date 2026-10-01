import { describe, it, expect, vi } from "vitest"
import { formatearFolioCatalogo, generarFolioCatalogo, mesAnioFolio, tipoFolioPorRegimen } from "./folio-catalogo"

describe("tipoFolioPorRegimen", () => {
  it("Honorarios → CH, Asimilados → CA", () => {
    expect(tipoFolioPorRegimen("honorarios")).toBe("CH")
    expect(tipoFolioPorRegimen("Honorarios")).toBe("CH")
    expect(tipoFolioPorRegimen("asimilados")).toBe("CA")
    expect(tipoFolioPorRegimen("Honorarios Asimilados a Salarios")).toBe("CA")
  })
  it("otro régimen o vacío → null (sin folio nuevo)", () => {
    expect(tipoFolioPorRegimen("nombramiento")).toBeNull()
    expect(tipoFolioPorRegimen(null)).toBeNull()
  })
})

describe("formatearFolioCatalogo", () => {
  it("NN/MM/AAAA-TIPO con consecutivo y mes a 2 dígitos", () => {
    expect(formatearFolioCatalogo(1, 9, 2026, "CH")).toBe("01/09/2026-CH")
    expect(formatearFolioCatalogo(12, 10, 2026, "CA")).toBe("12/10/2026-CA")
  })
  it("de 100 en adelante sigue creciendo sin romper el formato", () => {
    expect(formatearFolioCatalogo(99, 9, 2026, "CH")).toBe("99/09/2026-CH")
    expect(formatearFolioCatalogo(100, 9, 2026, "CH")).toBe("100/09/2026-CH")
  })
})

describe("mesAnioFolio — el mes es el de la fecha de generación en hora de México", () => {
  it("30 de septiembre 23:30 en México sigue siendo septiembre (aunque en UTC ya sea octubre)", () => {
    expect(mesAnioFolio(new Date("2026-10-01T05:30:00Z"))).toEqual({ mes: 9, anio: 2026 })
  })
  it("1 de octubre en México es octubre", () => {
    expect(mesAnioFolio(new Date("2026-10-01T12:00:00Z"))).toEqual({ mes: 10, anio: 2026 })
  })
  it("31 de diciembre → 1 de enero cambia también el año", () => {
    expect(mesAnioFolio(new Date("2027-01-01T12:00:00Z"))).toEqual({ mes: 1, anio: 2027 })
  })
})

describe("generarFolioCatalogo", () => {
  it("usa el consecutivo que devuelve el contador del mes (contador compartido CAT para CH y CA)", async () => {
    const queryRaw = vi.fn(async () => [{ consecutivo: 7 }])
    const folio = await generarFolioCatalogo({ $queryRaw: queryRaw } as any, "CA", new Date("2026-09-15T12:00:00Z"))
    expect(folio).toEqual({ folio: "07/09/2026-CA", folio_consecutivo: 7, folio_mes: 9, folio_anio: 2026, folio_tipo: "CA" })
    const valores = (queryRaw.mock.calls[0] as any[]).slice(1)
    expect(valores).toEqual(["CAT", 9, 2026])
  })
})
