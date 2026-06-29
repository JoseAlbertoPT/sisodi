"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { PageLayout } from "@/components/page-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Loader2,
  Eye,
  BookOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  Send,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import dynamic from "next/dynamic"

const PdfPreview = dynamic(() => import("@/components/pdf-preview").then((m) => m.PdfPreview), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground bg-muted rounded-md">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Cargando visor…</span>
    </div>
  ),
})

// ──────────────────── types ────────────────────

interface CatalogoRecord {
  id: number
  solicitud_id: number
  regimen_contratacion: string
  programa_proyecto: string
  tipo_actividad: string | null
  denominacion_nombramiento: string | null
  puesto_jefe_inmediato: string | null
  numero_personas: number | null
  tipo_pago: string | null
  importe_bruto: string | null
  vigencia: string | null
  archivo_pdf_sin_firmas: string | null
  activo: boolean
  creado_en: string
  solicitud: {
    id: number
    tipo_solicitud: string
    folio_recepcion: string | null
    folio_dictamen: string | null
    secretaria: string | null
    secretaria_txt_snapshot: string | null
  }
  _count: { catalogo_solicitudes: number }
}

interface AdminRecord extends CatalogoRecord {
  catalogo_solicitudes: {
    id: number
    nueva_vigencia: string
    nuevo_numero_personas: number | null
    nuevos_numero_prestadores: number | null
    creado_en: string
    usuario: { nombre: string; rfc: string }
  }[]
}

// ──────────────────── helpers ────────────────────

function fmt(val: string | null | undefined) {
  return val ?? "—"
}

function fmtMoney(val: string | null | undefined) {
  if (!val) return "—"
  const n = Number(val)
  if (isNaN(n)) return val
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
}

function entidadNombre(rec: CatalogoRecord) {
  return rec.solicitud.secretaria_txt_snapshot
    ?? rec.solicitud.secretaria
    ?? "—"
}

// ──────────────────── ConsultaTab ────────────────────

function ConsultaTab() {
  const { user } = useAuth()

  const [q, setQ]               = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage]         = useState(1)
  const [records, setRecords]   = useState<CatalogoRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const limit = 20

  // view-doc modal
  const [viewRec, setViewRec]     = useState<CatalogoRecord | null>(null)
  const [showView, setShowView]   = useState(false)

  // solicitar-reutilizacion modal
  const [solRec, setSolRec]       = useState<CatalogoRecord | null>(null)
  const [showSol, setShowSol]     = useState(false)
  const [solVigencia, setSolVigencia]       = useState("")
  const [solPersonas, setSolPersonas]       = useState("")
  const [solPrestadores, setSolPrestadores] = useState("")
  const [solLoading, setSolLoading]   = useState(false)
  const [solError, setSolError]       = useState<string | null>(null)
  const [solOk, setSolOk]             = useState(false)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [q])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        q: debouncedQ,
        page: String(page),
        limit: String(limit),
      })
      const res = await fetch(`/api/catalogo-justificaciones?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar catálogo")
      const data = await res.json()
      setRecords(data.records)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar catálogo")
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, page])

  useEffect(() => { void fetchData() }, [fetchData])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const openView = (rec: CatalogoRecord) => { setViewRec(rec); setShowView(true) }
  const openSol  = (rec: CatalogoRecord) => {
    setSolRec(rec)
    setSolVigencia("")
    setSolPersonas("")
    setSolPrestadores("")
    setSolError(null)
    setSolOk(false)
    setShowSol(true)
  }

  const handleSolicitar = async () => {
    if (!solRec || !user) return
    if (!solVigencia.trim()) { setSolError("La vigencia es requerida"); return }
    setSolLoading(true)
    setSolError(null)
    try {
      const res = await fetch("/api/catalogo-justificaciones/solicitar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogo_justificacion_id: solRec.id,
          usuario_id:                user.id,
          nueva_vigencia:            solVigencia.trim(),
          nuevo_numero_personas:     solPersonas ? Number(solPersonas) : null,
          nuevos_numero_prestadores: solPrestadores ? Number(solPrestadores) : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al solicitar")
      setSolOk(true)
      setTimeout(() => { setShowSol(false); setSolOk(false) }, 1800)
    } catch (e) {
      setSolError(e instanceof Error ? e.message : "Error al solicitar reutilización")
    } finally {
      setSolLoading(false)
    }
  }

  const isParaestatal = (rec: CatalogoRecord) =>
    rec.solicitud.tipo_solicitud.toLowerCase().includes("paraestatal")

  return (
    <>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por programa, denominación, vigencia…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <span className="text-sm text-muted-foreground">{total} registro{total !== 1 ? "s" : ""}</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-4 py-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Honorarios table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-6">
        <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-secondary" />
          <h3 className="text-sm font-semibold text-card-foreground">Honorarios</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Entidad</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Programa / Proyecto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Régimen</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Personas</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Importe bruto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Reutilizaciones</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && records.filter((r) => !isParaestatal(r)).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin registros de honorarios
                  </td>
                </tr>
              )}
              {!loading && records.filter((r) => !isParaestatal(r)).map((rec) => (
                <tr key={rec.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs max-w-[160px] truncate" title={entidadNombre(rec)}>{entidadNombre(rec)}</td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={rec.programa_proyecto}>{fmt(rec.programa_proyecto)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs capitalize">{fmt(rec.regimen_contratacion)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(rec.vigencia)}</td>
                  <td className="px-4 py-3 text-xs text-center">{rec.numero_personas ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{fmtMoney(rec.importe_bruto)}</td>
                  <td className="px-4 py-3 text-xs text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-secondary/10 text-secondary w-6 h-6 text-xs font-semibold">
                      {rec._count.catalogo_solicitudes}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver documento" onClick={() => openView(rec)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Solicitar reutilización" onClick={() => openSol(rec)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nombramiento table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-5">
        <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-secondary" />
          <h3 className="text-sm font-semibold text-card-foreground">Nombramiento / Paraestatal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Entidad</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Denominación / Nombramiento</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Tipo actividad</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Personas</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Reutilizaciones</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && records.filter((r) => isParaestatal(r)).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin registros de nombramiento / paraestatal
                  </td>
                </tr>
              )}
              {!loading && records.filter((r) => isParaestatal(r)).map((rec) => (
                <tr key={rec.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs max-w-[160px] truncate" title={entidadNombre(rec)}>{entidadNombre(rec)}</td>
                  <td className="px-4 py-3 text-xs max-w-[220px] truncate" title={rec.denominacion_nombramiento ?? ""}>{fmt(rec.denominacion_nombramiento)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(rec.tipo_actividad)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(rec.vigencia)}</td>
                  <td className="px-4 py-3 text-xs text-center">{rec.numero_personas ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-secondary/10 text-secondary w-6 h-6 text-xs font-semibold">
                      {rec._count.catalogo_solicitudes}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver documento" onClick={() => openView(rec)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Solicitar reutilización" onClick={() => openSol(rec)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Ver documento modal */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-base font-semibold">Documento de justificación</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4">
            {viewRec?.archivo_pdf_sin_firmas ? (
              <PdfPreview fileUrl={viewRec.archivo_pdf_sin_firmas} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">Sin archivo PDF disponible</p>
                <p className="text-xs text-center max-w-xs">
                  Este registro no tiene un PDF adjunto. El documento se vincula automáticamente
                  cuando el dictamen es emitido con archivo.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Solicitar reutilización modal */}
      <Dialog open={showSol} onOpenChange={setShowSol}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Solicitar reutilización</DialogTitle>
          </DialogHeader>
          {solRec && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs space-y-1">
                <p className="font-semibold text-card-foreground">{entidadNombre(solRec)}</p>
                <p className="text-muted-foreground">{fmt(solRec.programa_proyecto)}</p>
                <p className="text-muted-foreground">Vigencia actual: <span className="font-medium text-card-foreground">{fmt(solRec.vigencia)}</span></p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-card-foreground">
                  Nueva vigencia <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Ej: 01/01/2026 / 31/12/2026"
                  value={solVigencia}
                  onChange={(e) => setSolVigencia(e.target.value)}
                  disabled={solLoading || solOk}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-card-foreground">Núm. personas</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={solPersonas}
                    onChange={(e) => setSolPersonas(e.target.value)}
                    disabled={solLoading || solOk}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-card-foreground">Núm. prestadores</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={solPrestadores}
                    onChange={(e) => setSolPrestadores(e.target.value)}
                    disabled={solLoading || solOk}
                  />
                </div>
              </div>

              {solError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{solError}
                </div>
              )}
              {solOk && (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />Solicitud enviada correctamente
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setShowSol(false)} disabled={solLoading}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={handleSolicitar}
                  disabled={solLoading || solOk || !solVigencia.trim()}
                  style={{ backgroundColor: "#773357", color: "#fff" }}
                  className="hover:opacity-90 gap-2"
                >
                  {solLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {solLoading ? "Enviando…" : "Enviar solicitud"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ──────────────────── AdministracionTab ────────────────────

function AdministracionTab() {
  const [q, setQ]               = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage]         = useState(1)
  const [records, setRecords]   = useState<AdminRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const limit = 20

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [q])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q: debouncedQ, page: String(page), limit: String(limit) })
      const res = await fetch(`/api/catalogo-justificaciones/admin?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar datos")
      const data = await res.json()
      setRecords(data.records)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, page])

  useEffect(() => { void fetchData() }, [fetchData])

  const handleToggle = async (rec: AdminRecord) => {
    setToggling(rec.id)
    try {
      const res = await fetch(`/api/catalogo-justificaciones/${rec.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !rec.activo }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error")
      setRecords((prev) => prev.map((r) => r.id === rec.id ? { ...r, activo: !r.activo } : r))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar")
    } finally {
      setToggling(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar registro…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <span className="text-sm text-muted-foreground">{total} registro{total !== 1 ? "s" : ""}</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-4 py-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Entidad</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Programa / Proyecto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Régimen</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Creado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Reutilizaciones</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Activo</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin registros en el catálogo
                  </td>
                </tr>
              )}
              {!loading && records.map((rec) => (
                <React.Fragment key={rec.id}>
                  <tr className="border-b border-border hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={entidadNombre(rec)}>{entidadNombre(rec)}</td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={rec.programa_proyecto}>{fmt(rec.programa_proyecto)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{fmt(rec.regimen_contratacion)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(rec.vigencia)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(rec.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-secondary/10 text-secondary w-6 h-6 text-xs font-semibold">
                        {rec._count.catalogo_solicitudes}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={rec.activo ? "default" : "secondary"} className="text-xs">
                        {rec.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(rec)}
                        disabled={toggling === rec.id}
                        className="text-muted-foreground hover:text-secondary transition-colors disabled:opacity-50"
                        title={rec.activo ? "Desactivar" : "Activar"}
                      >
                        {toggling === rec.id
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : rec.activo
                            ? <ToggleRight className="h-5 w-5 text-secondary" />
                            : <ToggleLeft className="h-5 w-5" />
                        }
                      </button>
                    </td>
                  </tr>
                  {/* Reutilizaciones sub-rows */}
                  {rec.catalogo_solicitudes.length > 0 && rec.catalogo_solicitudes.map((sol) => (
                    <tr key={`sol-${sol.id}`} className="bg-muted/5 border-b border-dashed border-border/50">
                      <td className="px-4 py-2 pl-10" colSpan={2}>
                        <span className="text-xs text-muted-foreground">
                          ↳ {sol.usuario.nombre} ({sol.usuario.rfc})
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground" colSpan={2}>{sol.nueva_vigencia}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(sol.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}

// ──────────────────── Main page ────────────────────

export function CatalogoJustificacionesPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === "Administrador"

  return (
    <PageLayout
      title="Catálogo de Justificaciones"
      description="Consulta y reutilización de justificaciones dictaminadas previamente."
    >
      <Tabs defaultValue="consulta" className="w-full">
        <TabsList>
          <TabsTrigger value="consulta" className="gap-1.5">
            <Search className="h-4 w-4" />
            Consulta
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="administracion" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              Administración
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="consulta" className="mt-6">
          <ConsultaTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="administracion" className="mt-6">
            <AdministracionTab />
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  )
}
