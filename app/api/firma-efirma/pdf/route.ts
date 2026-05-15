import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"

const DEFAULT_BASE_URL = "http://localhost:3001"
const BYPASS = process.env.EFIRMA_BYPASS === "true"
const BYPASS_DIR = join(process.cwd(), ".firma-bypass")

async function fetchPdfFromPortal(uuid: string, projectToken: string, base: string) {
  return fetch(`${base}/api/files/${encodeURIComponent(uuid)}/original`, {
    headers: { "X-Project-Token": projectToken },
    redirect: "manual",
    cache: "no-store",
  })
}

async function fetchStorageKeyFromEstado(procesoId: string, projectToken: string, base: string): Promise<string | null> {
  try {
    const r = await fetch(`${base}/api/multifirma/${encodeURIComponent(procesoId)}/estado`, {
      headers: { "X-Project-Token": projectToken },
      cache: "no-store",
    })
    if (!r.ok) return null
    const j = await r.json()
    return j?.storageKey ?? null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const uuid = url.searchParams.get("uuid")
    const token = url.searchParams.get("t")
    if (!uuid || !token) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 })
    }

    // Permitir lookup tanto por token de firmante (link público) como por
    // token del propio usuario autenticado (interno — no aplica aquí).
    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: { firma_proceso: true },
    })
    if (!firmante)                                    return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.uuid !== String(uuid))  return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.estado === "completado") return NextResponse.json({ ok: false, error: "Proceso completado" }, { status: 409 })
    if (firmante.expira_en && firmante.expira_en < new Date()) {
      return NextResponse.json({ ok: false, error: "Link expirado" }, { status: 410 })
    }

    if (BYPASS) {
      try {
        const buf = await readFile(join(BYPASS_DIR, `${String(uuid)}.pdf`))
        return new NextResponse(new Uint8Array(buf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline",
            "Cache-Control": "no-store, private",
          },
        })
      } catch {
        return NextResponse.json({ ok: false, error: "PDF bypass no encontrado" }, { status: 404 })
      }
    }

    const base = (process.env.EFIRMA_PORTAL_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "")
    const projectToken = process.env.EFIRMA_PROJECT_TOKEN
    if (!projectToken) {
      return NextResponse.json({ ok: false, error: "EFIRMA_PROJECT_TOKEN no configurado" }, { status: 500 })
    }

    let res = await fetchPdfFromPortal(String(uuid), projectToken, base)

    if ((res.status === 404 || res.status === 302) && firmante.firma_proceso.proceso_id) {
      const storageKeyReal = await fetchStorageKeyFromEstado(firmante.firma_proceso.proceso_id, projectToken, base)
      if (storageKeyReal && storageKeyReal !== uuid) {
        try {
          await prisma.firma_proceso.update({
            where: { id: firmante.firma_proceso_id },
            data: { uuid: storageKeyReal },
          })
        } catch { /* ignorar */ }
        res = await fetchPdfFromPortal(storageKeyReal, projectToken, base)
      }
    }

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `No se pudo obtener el PDF (${res.status})` }, { status: 502 })
    }
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, private",
      },
    })
  } catch (err: any) {
    console.error("[firma-efirma/pdf]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
