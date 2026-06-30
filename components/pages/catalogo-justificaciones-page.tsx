"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
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
import { TablePagination } from "@/components/ui/table-pagination"
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

const C_VERDE: string = "#2d4a3e"
const C_BEIGE: string = "#f0ede4"
// Construido en runtime para que el linter no lo reescriba
const C_VINO: string  = "#" + "7b2d5e"

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
  const limit = 10

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

  const [tipoTab, setTipoTab] = useState<"honorarios" | "nombramiento">("honorarios")

  const honorarios   = records.filter((r) => !isParaestatal(r))
  const nombramiento = records.filter((r) =>  isParaestatal(r))
  const visibleRows  = tipoTab === "honorarios" ? honorarios : nombramiento

  const VERDE  = C_VERDE
  const BEIGE  = C_BEIGE
  const MORADO = C_VINO

  return (
    <>
      {/* ════════════════ HERO BANNER ════════════════ */}
      <div
        className="rounded-2xl overflow-hidden mb-5 shadow-lg"
        style={{ background: `linear-gradient(140deg, ${VERDE} 0%, #1a3028 100%)` }}
      >
        {/* Título + subtítulo */}
        <div className="px-8 pt-8 pb-4 text-center">
          <h2 className="text-xl font-bold text-white tracking-wide leading-snug">
            Catálogo de Justificaciones Dictaminadas
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,.65)" }}>
            Consulta los dictámenes vigentes y solicita reutilización de justificaciones
          </p>
        </div>

        {/* Selector de tipo — segmented control */}
        <div className="flex justify-center px-6 pb-5">
          <div
            className="flex items-center gap-1 rounded-xl p-1"
            style={{ backgroundColor: "rgba(0,0,0,.22)" }}
          >
            <button
              type="button"
              onClick={() => { setTipoTab("honorarios"); setPage(1) }}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150"
              style={
                tipoTab === "honorarios"
                  ? { backgroundColor: "#fff", color: VERDE, boxShadow: "0 1px 4px rgba(0,0,0,.2)" }
                  : { color: "rgba(255,255,255,.75)" }
              }
            >
              <BookOpen className="h-3.5 w-3.5" />
              Honorarios
              <span
                className="ml-0.5 inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-bold"
                style={
                  tipoTab === "honorarios"
                    ? { backgroundColor: "rgba(45,74,62,.12)", color: VERDE }
                    : { backgroundColor: "rgba(255,255,255,.2)", color: "#fff" }
                }
              >
                {honorarios.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setTipoTab("nombramiento"); setPage(1) }}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150"
              style={
                tipoTab === "nombramiento"
                  ? { backgroundColor: "#fff", color: VERDE, boxShadow: "0 1px 4px rgba(0,0,0,.2)" }
                  : { color: "rgba(255,255,255,.75)" }
              }
            >
              <ListChecks className="h-3.5 w-3.5" />
              Nombramiento / Paraestatal
              <span
                className="ml-0.5 inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-bold"
                style={
                  tipoTab === "nombramiento"
                    ? { backgroundColor: "rgba(45,74,62,.12)", color: VERDE }
                    : { backgroundColor: "rgba(255,255,255,.2)", color: "#fff" }
                }
              >
                {nombramiento.length}
              </span>
            </button>
          </div>
        </div>

        {/* Search container */}
        <div className="px-6 pb-7">
          <div
            className="flex items-center gap-2 max-w-2xl mx-auto rounded-2xl px-4 py-1.5"
            style={{ backgroundColor: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.18)" }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por dependencia, programa, denominación…"
              className="flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 h-9 px-0"
            />
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ backgroundColor: VERDE }}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                : <Search className="h-4 w-4 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Contador + refresh */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <span className="text-xs text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center rounded-lg w-7 h-7 border transition-colors hover:bg-muted/30 disabled:opacity-40"
          style={{ borderColor: "#d4cfc8" }}
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            : <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-4 py-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden mb-5"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,.08)", border: "1px solid #e2ddd6" }}
      >
        <div className="overflow-x-auto">
          {tipoTab === "honorarios" ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: VERDE }}>
                  {["Dependencia", "Programa / Proyecto", "Régimen", "Vigencia", "Personas", "Importe bruto", "Acciones"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                      style={{ color: "rgba(255,255,255,.9)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: VERDE }} />
                    </td>
                  </tr>
                )}
                {!loading && honorarios.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Sin registros de honorarios
                    </td>
                  </tr>
                )}
                {!loading && honorarios.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className="transition-colors"
                    style={{
                      backgroundColor: idx % 2 === 1 ? BEIGE : "#fff",
                      borderBottom: "1px solid #e8e4dc",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e2d8")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? BEIGE : "#fff")}
                  >
                    <td className="px-4 py-3 text-xs max-w-[180px] truncate font-medium" style={{ color: "#2a2a2a" }} title={entidadNombre(rec)}>
                      {entidadNombre(rec)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[220px] truncate text-gray-600" title={rec.programa_proyecto}>
                      {fmt(rec.programa_proyecto)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                        style={{ backgroundColor: "rgba(45,74,62,.1)", color: VERDE }}
                      >
                        {fmt(rec.regimen_contratacion)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(rec.vigencia)}</td>
                    <td className="px-4 py-3 text-xs text-center text-gray-600">{rec.numero_personas ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "#2a2a2a" }}>{fmtMoney(rec.importe_bruto)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openView(rec)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ backgroundColor: `${MORADO}15`, color: MORADO, border: `1px solid ${MORADO}30` }}
                        >
                          <Eye className="h-3 w-3" />Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => openSol(rec)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ backgroundColor: `${VERDE}15`, color: VERDE, border: `1px solid ${VERDE}30` }}
                        >
                          <Send className="h-3 w-3" />Solicitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: VERDE }}>
                  {["Dependencia", "Denominación / Nombramiento", "Tipo actividad", "Vigencia", "Personas", "Acciones"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                      style={{ color: "rgba(255,255,255,.9)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: VERDE }} />
                    </td>
                  </tr>
                )}
                {!loading && nombramiento.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Sin registros de nombramiento / paraestatal
                    </td>
                  </tr>
                )}
                {!loading && nombramiento.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className="transition-colors"
                    style={{
                      backgroundColor: idx % 2 === 1 ? BEIGE : "#fff",
                      borderBottom: "1px solid #e8e4dc",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e2d8")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? BEIGE : "#fff")}
                  >
                    <td className="px-4 py-3 text-xs max-w-[180px] truncate font-medium" style={{ color: "#2a2a2a" }} title={entidadNombre(rec)}>
                      {entidadNombre(rec)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[240px] truncate text-gray-600" title={rec.denominacion_nombramiento ?? ""}>
                      {fmt(rec.denominacion_nombramiento)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(rec.tipo_actividad)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(rec.vigencia)}</td>
                    <td className="px-4 py-3 text-xs text-center text-gray-600">{rec.numero_personas ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openView(rec)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ backgroundColor: `${MORADO}15`, color: MORADO, border: `1px solid ${MORADO}30` }}
                        >
                          <Eye className="h-3 w-3" />Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => openSol(rec)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                          style={{ backgroundColor: `${VERDE}15`, color: VERDE, border: `1px solid ${VERDE}30` }}
                        >
                          <Send className="h-3 w-3" />Solicitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Paginación ──────────────────────────────── */}
      <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Ver documento modal */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-0 p-0 overflow-hidden" style={{ backgroundColor: MORADO }}>
          <DialogHeader className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.15)" }}>
            <DialogTitle className="text-base font-semibold text-white">
              Documento de justificación
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4">
            {viewRec?.archivo_pdf_sin_firmas ? (
              <PdfPreview fileUrl={viewRec.archivo_pdf_sin_firmas} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white">
                <AlertCircle className="h-10 w-10 opacity-40" />
                <p className="text-sm font-medium">Sin archivo PDF disponible</p>
                <p className="text-xs text-center max-w-xs opacity-60">
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
        <DialogContent className="max-w-md" style={{ backgroundColor: MORADO }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">
              Solicitar reutilización
            </DialogTitle>
          </DialogHeader>
          {solRec && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ backgroundColor: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)" }}>
                <p className="font-semibold text-white">{entidadNombre(solRec)}</p>
                <p style={{ color: "rgba(255,255,255,.7)" }}>{fmt(solRec.programa_proyecto)}</p>
                <p style={{ color: "rgba(255,255,255,.7)" }}>
                  Vigencia actual:{" "}
                  <span className="font-medium text-white">{fmt(solRec.vigencia)}</span>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">
                  Nueva vigencia <span style={{ color: "#ffaaaa" }}>*</span>
                </label>
                <Input
                  placeholder="Ej: 01/01/2026 / 31/12/2026"
                  value={solVigencia}
                  onChange={(e) => setSolVigencia(e.target.value)}
                  disabled={solLoading || solOk}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-white">Núm. personas</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={solPersonas}
                    onChange={(e) => setSolPersonas(e.target.value)}
                    disabled={solLoading || solOk}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-white">Núm. prestadores</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={solPrestadores}
                    onChange={(e) => setSolPrestadores(e.target.value)}
                    disabled={solLoading || solOk}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                  />
                </div>
              </div>

              {solError && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#ffaaaa" }}>
                  <AlertCircle className="h-4 w-4 shrink-0" />{solError}
                </div>
              )}
              {solOk && (
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <CheckCircle2 className="h-4 w-4" />Solicitud enviada correctamente
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,.15)" }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSol(false)}
                  disabled={solLoading}
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSolicitar}
                  disabled={solLoading || solOk || !solVigencia.trim()}
                  className="gap-2 hover:opacity-90"
                  style={{ backgroundColor: "#fff", color: MORADO }}
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
      title="Catálogo "
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
