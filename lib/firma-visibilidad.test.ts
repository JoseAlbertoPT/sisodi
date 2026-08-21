import { describe, it, expect } from "vitest"
import { puedeMostrarFolioDictamen } from "./firma-visibilidad"

describe("puedeMostrarFolioDictamen", () => {
  it("true cuando el estado es exactamente 'Emitido'", () => {
    expect(puedeMostrarFolioDictamen("Emitido")).toBe(true)
  })

  it("true sin distinguir mayúsculas/minúsculas ni espacios extra", () => {
    expect(puedeMostrarFolioDictamen("emitido")).toBe(true)
    expect(puedeMostrarFolioDictamen("  Emitido  ")).toBe(true)
    expect(puedeMostrarFolioDictamen("EMITIDO")).toBe(true)
  })

  it("false para estados previos a la última firma", () => {
    expect(puedeMostrarFolioDictamen("Pendiente Firma Dictamen")).toBe(false)
    expect(puedeMostrarFolioDictamen("Pendiente Firma Justificacion")).toBe(false)
    expect(puedeMostrarFolioDictamen("En Revision Emisor")).toBe(false)
  })

  it("false para null/undefined/cadena vacía", () => {
    expect(puedeMostrarFolioDictamen(null)).toBe(false)
    expect(puedeMostrarFolioDictamen(undefined)).toBe(false)
    expect(puedeMostrarFolioDictamen("")).toBe(false)
  })
})
