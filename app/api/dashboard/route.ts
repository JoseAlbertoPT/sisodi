import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const anio     = parseInt(searchParams.get("anio") ?? String(new Date().getFullYear()), 10)
    const mesParam = searchParams.get("mes")
    const mes      = mesParam ? parseInt(mesParam, 10) : null

    
    const fechaDesde = mes
      ? new Date(anio, mes - 1, 1)
      : new Date(anio, 0, 1)
    const fechaHasta = mes
      ? new Date(anio, mes, 1)
      : new Date(anio + 1, 0, 1)

    const baseWhere = {
      fecha_creacion:  { gte: fechaDesde, lt: fechaHasta },
      folio_recepcion: { not: null as string | null },
    }

    
    const [
      totalRecibidas, prestadoresAgg, regimenRows,
      prestadoresSecretariaRows, prestadoresCentralizadaAgg, prestadoresParaestatalAgg,
      prestadoresRegimenRows,
    ] = await Promise.all([
      prisma.solicitud.count({ where: baseWhere }),
      prisma.solicitud.aggregate({
        where: baseWhere,
        _sum: { numero_prestadores: true },
      }),
      prisma.solicitud.groupBy({
        by:    ["regimen"],
        where: baseWhere,
        _count: { id: true },
      }),
      
      prisma.solicitud.findMany({
        where: { ...baseWhere, numero_prestadores: { gt: 0 } },
        select: {
          secretaria:          true,
          numero_prestadores:  true,
          tipo_administracion: true,
        },
      }),

      prisma.solicitud.aggregate({
        where: { ...baseWhere, tipo_administracion: { not: "paraestatal" } },
        _sum:  { numero_prestadores: true },
      }),

      prisma.solicitud.aggregate({
        where: { ...baseWhere, tipo_administracion: "paraestatal" },
        _sum:  { numero_prestadores: true },
      }),
      
      prisma.solicitud.groupBy({
        by:    ["regimen"],
        where: { ...baseWhere, numero_prestadores: { gt: 0 } },
        _sum:  { numero_prestadores: true },
      }),
    ])

    const prestadores = Number(prestadoresAgg._sum.numero_prestadores ?? 0)

    function countRegimen(keyword: string, exclude?: string) {
      return regimenRows
        .filter(r => {
          const v = (r.regimen ?? "").toLowerCase()
          return v.includes(keyword) && (!exclude || !v.includes(exclude))
        })
        .reduce((s, r) => s + r._count.id, 0)
    }

    const honorarios   = countRegimen("honorario", "asimilad")
    const asimilados   = countRegimen("asimilad")
    const nombramiento = countRegimen("nombramiento")

    const emitidas = await prisma.solicitud.count({
      where: { ...baseWhere, estado: { nombre: { equals: "Emitido", mode: "insensitive" } } },
    })

    const enProceso = totalRecibidas - emitidas

    
    
    
    const [centralRows, paraRows] = await Promise.all([
      prisma.solicitud.groupBy({
        by:    ["secretaria"],
        where: {
          ...baseWhere,
          tipo_administracion: { not: "paraestatal" },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 15,
      }),
      prisma.solicitud.groupBy({
        by:    ["secretaria"],
        where: {
          ...baseWhere,
          tipo_administracion: "paraestatal",
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 15,
      }),
    ])

    
    
    
    
    const emisionRows = await prisma.solicitud.findMany({
      where: {
        ...baseWhere,
        estado: { nombre: { equals: "Emitido", mode: "insensitive" } },
      },
      select: {
        secretaria:          true,
        tipo_administracion: true,
      },
    })

    const emisionMap = new Map<string, { dictamenes: number; opiniones: number }>()
    for (const row of emisionRows) {
      const sec = row.secretaria ?? "Sin especificar"
      if (!emisionMap.has(sec)) emisionMap.set(sec, { dictamenes: 0, opiniones: 0 })
      const entry = emisionMap.get(sec)!
      if (row.tipo_administracion === "paraestatal") {
        entry.opiniones += 1
      } else {
        entry.dictamenes += 1
      }
    }
    const emisionesPorSecretaria = [...emisionMap.entries()]
      .map(([secretaria, c]) => ({ secretaria, ...c }))
      .sort((a, b) => (b.dictamenes + b.opiniones) - (a.dictamenes + a.opiniones))
      .slice(0, 15)

    
    const secMap = new Map<string, { secretaria: string; prestadores: number; tipo: "Centralizada" | "Paraestatal" }>()
    for (const row of prestadoresSecretariaRows) {
      const sec  = row.secretaria ?? "Sin especificar"
      const tipo = row.tipo_administracion === "paraestatal" ? "Paraestatal" : "Centralizada"
      const key  = `${sec}::${tipo}`
      const prev = secMap.get(key)
      if (!prev) {
        secMap.set(key, { secretaria: sec, prestadores: Number(row.numero_prestadores ?? 0), tipo })
      } else {
        prev.prestadores += Number(row.numero_prestadores ?? 0)
      }
    }
    const prestadoresPorSecretaria = [...secMap.values()]
      .filter(r => r.prestadores > 0)
      .sort((a, b) => b.prestadores - a.prestadores)
      .slice(0, 30)

    const prestadoresPorTipo = [
      { tipo: "Centralizada", prestadores: Number(prestadoresCentralizadaAgg._sum.numero_prestadores ?? 0) },
      { tipo: "Paraestatal",  prestadores: Number(prestadoresParaestatalAgg._sum.numero_prestadores  ?? 0) },
    ].filter(r => r.prestadores > 0)

    function normalizaRegimenLabel(r: string | null): string {
      const v = (r ?? "").toLowerCase()
      if (v.includes("asimilad"))   return "Honorarios Asimilados a Salarios"
      if (v.includes("honorario"))  return "Honorarios"
      if (v.includes("nombramiento")) return "Nombramiento por Tiempo Determinado"
      return r ?? "Sin especificar"
    }
    const regimenPrestMap = new Map<string, number>()
    for (const row of prestadoresRegimenRows) {
      const label = normalizaRegimenLabel(row.regimen)
      regimenPrestMap.set(label, (regimenPrestMap.get(label) ?? 0) + Number(row._sum.numero_prestadores ?? 0))
    }
    const prestadoresPorRegimen = [...regimenPrestMap.entries()]
      .map(([regimen, prestadores]) => ({ regimen, prestadores }))
      .filter(r => r.prestadores > 0)

    return NextResponse.json({
      ok:   true,
      data: {
        totalRecibidas,
        honorarios,
        asimilados,
        nombramiento,
        emitidas,
        prestadores,
        enProceso,
        porSecretariaCentralizada: centralRows.map(r => ({
          secretaria: r.secretaria ?? "Sin especificar",
          count:      r._count.id,
        })),
        porSecretariaParaestatal: paraRows.map(r => ({
          secretaria: r.secretaria ?? "Sin especificar",
          count:      r._count.id,
        })),
        emisionesPorSecretaria,
        prestadoresPorSecretaria,
        prestadoresPorTipo,
        prestadoresPorRegimen,
      },
    })
  } catch (error: any) {
    console.error("[GET /api/dashboard]", error)
    return NextResponse.json({ ok: false, error: mensajePublico(error, "Error interno") }, { status: 500 })
  }
}

function empty() {
  return {
    totalRecibidas:            0,
    honorarios:                0,
    asimilados:                0,
    nombramiento:              0,
    emitidas:                  0,
    prestadores:               0,
    enProceso:                 0,
    porSecretariaCentralizada: [],
    porSecretariaParaestatal:  [],
    emisionesPorSecretaria:   [],
    prestadoresPorSecretaria: [],
    prestadoresPorTipo:       [],
    prestadoresPorRegimen:    [],
  }
}
