import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function normalize(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function detectKey(obj: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(obj)
  for (const key of keys) {
    for (const c of candidates) {
      if (key.toLowerCase().includes(c.toLowerCase())) return key
    }
  }
  return ""
}

const COL_SECRETARIA = ["SECRETAR", "DEPENDENCIA", "ORGANISMO AUXILIAR"]
const COL_UA_NOMBRE = ["UNIDAD ADMINISTRATIVA DE ADSCRIPCI", "UNIDAD ADMINISTRATIVA", "NOMBRE UA", "UA NOMBRE"]
const COL_UA_CLAVE  = ["UA DE CLAVES", "UA CLAVE", "CLAVE UA", "CLAVE ADMINISTRATIVA", "CLAVE DE UNIDAD", "CLAVE PRESUPUESTAL"]
const COL_UA_ADSCRIPCION = ["UNIDAD ADMINISTRATIVA DE ADSCRIPCI"]

// Unidad: nombre normalizado → clave original (vacío si no se encontró)
type UaMap = Map<string, string>

function addUa(map: Map<string, UaMap>, sec: string, nombre: string, clave = "") {
  if (!map.has(sec)) map.set(sec, new Map())
  const uas = map.get(sec)!
  if (!uas.has(nombre)) uas.set(nombre, clave)
  else if (!uas.get(nombre) && clave) uas.set(nombre, clave)
}

function processSheets(
  sheets: Record<string, unknown[]>,
  centralizada: Map<string, UaMap>,
  adscripcion: Map<string, UaMap>
) {
  for (const rows of Object.values(sheets)) {
    if (!Array.isArray(rows) || rows.length === 0) continue
    const firstRow = rows[0] as Record<string, unknown>

    const colSec  = detectKey(firstRow, COL_SECRETARIA)
    const colNom  = detectKey(firstRow, COL_UA_NOMBRE)
    const colClave = detectKey(firstRow, COL_UA_CLAVE)
    const colAdsc = detectKey(firstRow, COL_UA_ADSCRIPCION)

    if (!colSec) continue

    for (const row of rows) {
      const r = row as Record<string, unknown>
      const sec = r[colSec]
      if (!sec || String(sec).trim() === "") continue
      const secNorm = normalize(String(sec))

      const claveVal = colClave ? String(r[colClave] ?? "").trim() : ""

      if (colNom && colNom !== colAdsc) {
        const ua = r[colNom]
        if (ua && String(ua).trim()) addUa(centralizada, secNorm, normalize(String(ua)), claveVal)
      }

      if (colAdsc) {
        const ua = r[colAdsc]
        if (ua && String(ua).trim()) addUa(adscripcion, secNorm, normalize(String(ua)), claveVal)
      }
    }
  }
}

export async function GET() {
  try {
    const historicos = await prisma.historico.findMany({
      orderBy: { subido_en: "desc" },
    })

    const centralizada = new Map<string, UaMap>()
    const adscripcion  = new Map<string, UaMap>()

    for (const h of historicos) {
      processSheets(h.sheets as Record<string, unknown[]>, centralizada, adscripcion)
      if (h.sheets2) processSheets(h.sheets2 as Record<string, unknown[]>, centralizada, adscripcion)
    }

    const tree = Array.from(centralizada.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([secNombre, uas], i) => {
        const uasAdsc = adscripcion.get(secNombre) ?? new Map<string, string>()
        const todas = new Map([...uas, ...uasAdsc])

        return {
          id: `sec-${i}`,
          nombre: secNombre,
          orden: i,
          tipo: "SECRETARIA",
          parent_id: null,
          ua_clave_administrativa: null as string | null,
          clave_reporte_plazas: null as string | null,
          children: Array.from(todas.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([nombre, clave], j) => ({
              id: `sec-${i}-ua-${j}`,
              nombre,
              orden: j,
              tipo: "UNIDAD",
              parent_id: `sec-${i}`,
              ua_clave_administrativa: clave || null,
              clave_reporte_plazas: null as string | null,
              children: [],
            })),
        }
      })

    return NextResponse.json(tree)
  } catch (e) {
    console.error("[GET /api/catalogo/desde-historico]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}