"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { PageLayout } from "@/components/page-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerHabil, dateToIso } from "@/components/ui/date-picker-habil"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import { SearchInput } from "@/components/ui/search-input"
import { StatusBadge } from "@/components/ui/status-badge"
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
  MoreVertical,
  Power,
  PowerOff,
  FileText,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
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
  importe_neto: string | null
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
    procesado: boolean
    procesado_en: string | null
    solicitud_nueva_id: number | null
    folio_nueva: string | null
    creado_en: string
    usuario: { nombre: string; rfc: string }
  }[]
}

const C_VERDE: string = "#2d4a3e"
const C_BEIGE: string = "#f0ede4"
const C_VINO: string  = "#773357"
function fmt(val: string | null | undefined) {
  return val ?? "—"
}
function fmtCapitalize(val: string | null | undefined) {
  if (!val) return "—"
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
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

function ConsultaTab() {
  const { user } = useAuth()
  const [q, setQ]               = useState("")
  const [page, setPage]         = useState(1)
  const [allRecords, setAllRecords] = useState<CatalogoRecord[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const limit = 10
  const [viewRec, setViewRec]     = useState<CatalogoRecord | null>(null)
  const [showView, setShowView]   = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfBlobRef = useRef<string | null>(null)
  const [solRec, setSolRec]       = useState<CatalogoRecord | null>(null)
  const [showSol, setShowSol]     = useState(false)
  const [solVigInicio, setSolVigInicio]     = useState<Date | undefined>(undefined)
  const [solVigFin,    setSolVigFin]        = useState<Date | undefined>(undefined)
  const [solPersonas, setSolPersonas]       = useState("")
  const [solPrestadores, setSolPrestadores] = useState("")
  const [solLoading, setSolLoading]   = useState(false)
  const [solError, setSolError]       = useState<string | null>(null)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: "1", limit: "1000", userId: user?.id ?? "" })
      const res = await fetch(`/api/catalogo-justificaciones?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar catálogo")
      const data = await res.json()
      setAllRecords(data.records)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar catálogo")
    } finally {
      setLoading(false)
    }
  }, [user?.id])
  useEffect(() => { void fetchData() }, [fetchData])
  const norm = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  const records = q.trim()
    ? (() => {
        const words = norm(q).split(/\s+/).filter(Boolean)
        return allRecords.filter((r) => {
          const haystack = norm([
            r.programa_proyecto,
            r.tipo_actividad,
            r.denominacion_nombramiento,
            r.vigencia,
            r.regimen_contratacion,
            r.solicitud.secretaria_txt_snapshot,
            r.solicitud.secretaria,
          ].join(" "))
          return words.every((w) => haystack.includes(w))
        })
      })()
    : allRecords
  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    if (!showView || !viewRec) return
    const controller = new AbortController()
    setPdfBlobUrl(null)
    setPdfLoading(true)
    fetch(`/api/pdf/justificacion?id=${viewRec.solicitud.id}&sinFirmas=true`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Error al generar PDF"); return r.blob() })
      .then((blob) => {
        if (controller.signal.aborted) return
        const url = URL.createObjectURL(blob)
        if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current)
        pdfBlobRef.current = url
        setPdfBlobUrl(url)
      })
      .catch((e) => { if (e?.name !== "AbortError") console.error("[PDF catálogo]", e) })
      .finally(() => { if (!controller.signal.aborted) setPdfLoading(false) })
    return () => {
      controller.abort()
    }
  }, [showView, viewRec])
  const openView = (rec: CatalogoRecord) => { setViewRec(rec); setShowView(true) }
  const openSol  = (rec: CatalogoRecord) => {
    setSolRec(rec)
    setSolVigInicio(undefined)
    setSolVigFin(undefined)
    setSolPersonas("")
    setSolPrestadores("")
    setSolError(null)
    setShowSol(true)
  }
  const handleSolicitar = async () => {
    if (!solRec || !user) return
    if (!solVigInicio || !solVigFin) { setSolError("La vigencia es requerida"); return }
    setSolLoading(true)
    setSolError(null)
    try {
      const vi = dateToIso(solVigInicio!)
      const vf = dateToIso(solVigFin!)
      const npNum = isParaestatal(solRec) ? (solPersonas ? Number(solPersonas) : null) : null
      const nprNum = !isParaestatal(solRec) ? (solPrestadores ? Number(solPrestadores) : null) : null

      await fetch("/api/catalogo-justificaciones/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogo_justificacion_id: solRec.id,
          usuario_id: user.id,
          nueva_vigencia: `${vi} / ${vf}`,
          nuevo_numero_personas: npNum,
          nuevos_numero_prestadores: nprNum,
        }),
      })
      const np = isParaestatal(solRec) ? (solPersonas || "") : (solPrestadores || "")
      const params = new URLSearchParams({
        id: String(solRec.solicitud.id),
        vigenciaInicio: vi,
        vigenciaFin: vf,
        sinFirmas: "true",
      })
      if (np) params.set("numeroPersonas", np)
      const pdfRes = await fetch(`/api/pdf/justificacion?${params}`)
      if (!pdfRes.ok) throw new Error("Error al generar el PDF")
      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Justificacion_${solRec.solicitud.folio_dictamen ?? solRec.solicitud.folio_recepcion ?? solRec.id}_${vi}_${vf}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setShowSol(false)
    } catch (e) {
      setSolError(e instanceof Error ? e.message : "Error al generar el PDF")
    } finally {
      setSolLoading(false)
    }
  }
  const isParaestatal = (rec: CatalogoRecord) => {
    const t = rec.solicitud.tipo_solicitud.toLowerCase()
    return t.includes("paraestatal") || t.includes("nombramiento")
  }
  const [tipoTab, setTipoTab] = useState<"honorarios" | "nombramiento">("honorarios")
  useEffect(() => { setPage(1) }, [tipoTab])
  const honorarios    = records.filter((r) => !isParaestatal(r))
  const nombramiento  = records.filter((r) =>  isParaestatal(r))
  const allVisible    = tipoTab === "honorarios" ? honorarios : nombramiento
  const totalPages    = Math.max(1, Math.ceil(allVisible.length / limit))
  const visibleRows   = allVisible.slice((page - 1) * limit, page * limit)
  const VERDE  = C_VERDE
  const BEIGE  = C_BEIGE
  const MORADO = C_VINO
  return (
    <>
      <div className="mb-6 flex w-full flex-col items-center text-center">
        <h2 className="text-2xl font-bold tracking-wide leading-snug text-[#1F2937]">
          Catálogo de Justificaciones Dictaminadas
        </h2>
        <p className="mt-1.5 text-sm text-[#6B7280]">
          Consulta los dictámenes vigentes y solicita reutilización de justificaciones
        </p>

        <div className="mt-5 flex w-full flex-col items-center gap-4">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1.5">
            <button
              type="button"
              onClick={() => { setTipoTab("honorarios"); setPage(1) }}
              className="flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition-all duration-150"
              style={
                tipoTab === "honorarios"
                  ? { backgroundColor: "#e4e3d6", border: "1px solid #c2d4a8", color: "#3a4a2a" }
                  : { color: "#6B7280", border: "1px solid transparent" }
              }
            >
              <BookOpen className="h-4 w-4" />
              Honorarios
              <span
                className="ml-0.5 inline-flex items-center justify-center rounded-full w-5 h-5 text-[11px] font-bold"
                style={
                  tipoTab === "honorarios"
                    ? { backgroundColor: "#f3f4f6", color: "#1f1f1f" }
                    : { backgroundColor: "#F3F4F6", color: "#6B7280" }
                }
              >
                {honorarios.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setTipoTab("nombramiento"); setPage(1) }}
              className="flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition-all duration-150"
              style={
                tipoTab === "nombramiento"
                  ? { backgroundColor: "#e4e3d6", border: "1px solid #c2d4a8", color: "#3a4a2a" }
                  : { color: "#6B7280", border: "1px solid transparent" }
              }
            >
              <ListChecks className="h-4 w-4" />
              Nombramiento por Tiempo Determinado
              <span
                className="ml-0.5 inline-flex items-center justify-center rounded-full w-5 h-5 text-[11px] font-bold"
                style={
                  tipoTab === "nombramiento"
                    ? { backgroundColor: "#f3f4f6", color: "#1f1f1f" }
                    : { backgroundColor: "#F3F4F6", color: "#6B7280" }
                }
              >
                {nombramiento.length}
              </span>
            </button>
          </div>
          <div
            className="flex items-center gap-2 w-full max-w-5xl rounded-full pl-6 pr-2 py-2 shadow-sm border-2 border-transparent transition-colors focus-within:border-[#2D3B2D]"
            style={{ backgroundColor: "#fff" }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por dependencia, programa, denominación…"
              className="flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 h-11 px-0"
            />
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center rounded-full w-11 h-11 shrink-0 transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ backgroundColor: MORADO }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                : <Search className="h-5 w-5 text-white" strokeWidth={2.75} />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mb-4">
        <span className="text-xs text-muted-foreground">
          {allVisible.length} registro{allVisible.length !== 1 ? "s" : ""}{q.trim() ? ` de ${allRecords.length}` : ""}
        </span>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center rounded-lg w-7 h-7 border transition-colors hover:bg-muted/30 disabled:opacity-40"
          style={{ borderColor: "rgb(120 5 84 / 0.62)" }}
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
      <div
        className="rounded-xl overflow-hidden mb-5"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,.08)", border: "1px solid #e2ddd6" }}
      >
        <div className="overflow-x-auto">
          {tipoTab === "honorarios" ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: VERDE }}>
                  {["Programa / Proyecto", "Tipo de actividad", "Régimen", "Tipo de pago", "Importe bruto", "Acciones"].map((h) => (
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
                {!loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Sin registros de honorarios
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.map((rec, idx) => (
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
                    <td className="px-4 py-3 text-xs max-w-[220px] truncate font-medium" style={{ color: "#2a2a2a" }} title={rec.programa_proyecto}>
                      {fmt(rec.programa_proyecto)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate text-gray-600">{fmt(rec.tipo_actividad)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={fmtCapitalize(rec.regimen_contratacion)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{fmt(rec.tipo_pago)}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "#2a2a2a" }}>{fmtMoney(rec.importe_bruto)}</td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
                            aria-label="Acciones"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(rec)}>
                            <Eye className="h-4 w-4" /> Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSol(rec)}>
                            <Send className="h-4 w-4" /> Solicitar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: VERDE }}>
                  {["Programa / Proyecto", "Denominación", "Puesto jefe inmediato", "Tipo de actividad", "Personas", "Importe neto", "Tipo de pago", "Acciones"].map((h) => (
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
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: VERDE }} />
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Sin registros de nombramiento por tiempo determinado
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.map((rec, idx) => (
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
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate font-medium" style={{ color: "#2a2a2a" }} title={rec.programa_proyecto}>
                      {fmt(rec.programa_proyecto)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate text-gray-600" title={rec.denominacion_nombramiento ?? ""}>
                      {fmt(rec.denominacion_nombramiento)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[160px] truncate text-gray-500">{fmt(rec.puesto_jefe_inmediato)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(rec.tipo_actividad)}</td>
                    <td className="px-4 py-3 text-xs text-center text-gray-600">{rec.numero_personas ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "#2a2a2a" }}>{fmtMoney(rec.importe_bruto)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{fmt(rec.tipo_pago)}</td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
                            aria-label="Acciones"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(rec)}>
                            <Eye className="h-4 w-4" /> Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSol(rec)}>
                            <Send className="h-4 w-4" /> Solicitar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent showCloseButton={false} className="w-[75vw] max-w-[75vw] sm:max-w-[75vw] h-[92vh] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden bg-white">
          <DialogHeader className="flex flex-row items-center gap-3 px-5 py-4 border-b border-border shrink-0 space-y-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="text-base font-semibold text-card-foreground truncate">
                Documento de justificación
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {(viewRec?.solicitud.secretaria || viewRec?.solicitud.secretaria_txt_snapshot) ?? "—"}
                {" · "}{viewRec?.solicitud.tipo_solicitud ?? "—"}
                {" · "}{viewRec ? new Date(viewRec.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-[#1F2937] p-3">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Cargando documento…</span>
              </div>
            ) : pdfBlobUrl ? (
              <PdfPreview fileUrl={pdfBlobUrl} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20">
                  <AlertCircle className="h-7 w-7 text-white/70" />
                </div>
                <p className="text-sm font-semibold text-white">Sin archivo PDF disponible</p>
                <p className="text-xs text-center max-w-xs text-white/60">
                  No se pudo generar el documento para este registro.
                </p>
              </div>
            )}
          </div>
          <div className="px-4 pb-4 pt-3 flex justify-end border-t border-border shrink-0">
            <Button
              onClick={() => { if (viewRec) { setShowView(false); openSol(viewRec) } }}
              className="gap-2 px-5 py-2.5 h-auto rounded-2xl hover:opacity-90 font-medium"
              style={{ backgroundColor: MORADO, color: "#fff" }}
            >
              Solicitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showSol} onOpenChange={setShowSol}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <DialogTitle className="text-base font-semibold text-[#1F2937]">
              Generar dictamen
            </DialogTitle>
          </div>
          {solRec && (
            <div className="flex flex-col gap-4 px-6 py-5">
              <p className="text-xs text-[#6B7280]">
                {isParaestatal(solRec)
                  ? "Ajusta la vigencia y el número de personas. Se descargará el PDF del dictamen sin firmas."
                  : "Ajusta la vigencia y el número de prestadores de servicio. Se descargará el PDF del dictamen sin firmas."}
              </p>
              <div className="rounded-lg px-4 py-3 text-xs space-y-1 bg-[#F3F4F6] border border-[#E5E7EB]">
                <p className="font-semibold text-[#1F2937]">{entidadNombre(solRec)}</p>
                <p className="text-[#6B7280]">{fmt(solRec.programa_proyecto)}</p>
                <p className="text-[#6B7280]">
                  Vigencia actual:{" "}
                  <span className="font-medium text-[#1F2937]">{fmt(solRec.vigencia)}</span>
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Nueva vigencia <span className="text-destructive"></span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Inicio</span>
                    <DatePickerHabil
                      value={solVigInicio}
                      onChange={(d) => setSolVigInicio(d)}
                      placeholder="Seleccionar inicio"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Término</span>
                    <DatePickerHabil
                      value={solVigFin}
                      fromDate={solVigInicio}
                      onChange={(d) => setSolVigFin(d)}
                      placeholder="Seleccionar término"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {isParaestatal(solRec) ? (
                  <>
                    <Label className="text-sm font-medium">Núm. personas a contratar</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={solPersonas}
                      onChange={(e) => setSolPersonas(e.target.value)}
                      disabled={solLoading}
                      className="bg-background"
                    />
                  </>
                ) : (
                  <>
                    <Label className="text-sm font-medium">Núm. prestadores de servicio</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={solPrestadores}
                      onChange={(e) => setSolPrestadores(e.target.value)}
                      disabled={solLoading}
                      className="bg-background"
                    />
                  </>
                )}
              </div>
              {solError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{solError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#E5E7EB]">
                <Button
                  variant="default"
                  onClick={() => setShowSol(false)}
                  disabled={solLoading}
                  className="px-5 py-2.5 h-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSolicitar}
                  disabled={solLoading || !solVigInicio || !solVigFin}
                  className="gap-2 px-5 py-2.5 h-auto"
                  style={{ backgroundColor: MORADO, color: "#fff" }}
                >
                  {solLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {solLoading ? "Generando…" : "Generar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AdministracionTab() {
  const [q, setQ]               = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage]         = useState(1)
  const [records, setRecords]   = useState<AdminRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [toggling, setToggling]         = useState<number | null>(null)
  const [procesando, setProcesando]     = useState<number | null>(null)
  const { user } = useAuth()
  const limit = 10
  const hasDataRef = useRef(false)
  const [viewRec, setViewRec]                     = useState<AdminRecord | null>(null)
  const [showReutilizaciones, setShowReutilizaciones] = useState(false)
  const [reutilizacionesPage, setReutilizacionesPage] = useState(1)
  const [reutilizacionesQuery, setReutilizacionesQuery] = useState("")
  const openReutilizaciones = (rec: AdminRecord) => {
    setViewRec(rec)
    setReutilizacionesPage(1)
    setReutilizacionesQuery("")
    setShowReutilizaciones(true)
  }
  const reutilizacionesFiltradas = (viewRec?.catalogo_solicitudes ?? []).filter((sol) => {
    const q = reutilizacionesQuery.trim().toLowerCase()
    if (!q) return true
    return sol.usuario.nombre.toLowerCase().includes(q)
      || sol.usuario.rfc.toLowerCase().includes(q)
      || sol.nueva_vigencia.toLowerCase().includes(q)
  })
  const reutilizacionesTotalPages = Math.max(1, Math.ceil(reutilizacionesFiltradas.length / ITEMS_PER_PAGE))
  const reutilizacionesVisibles = reutilizacionesFiltradas.slice(
    (reutilizacionesPage - 1) * ITEMS_PER_PAGE,
    reutilizacionesPage * ITEMS_PER_PAGE,
  )
  useEffect(() => { setReutilizacionesPage(1) }, [reutilizacionesQuery])

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [q])
  const fetchData = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q: debouncedQ, page: String(page), limit: String(limit), userId: user?.id ?? "" })
      const res = await fetch(`/api/catalogo-justificaciones/admin?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar datos")
      const data = await res.json()
      setRecords(data.records)
      setTotal(data.total)
      hasDataRef.current = true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, page, user?.id])
  useEffect(() => { void fetchData() }, [fetchData])
  useRealtime(["catalogo"], fetchData)
  const handleToggle = async (rec: AdminRecord) => {
    setToggling(rec.id)
    try {
      const res = await fetch(`/api/catalogo-justificaciones/${rec.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !rec.activo, userId: user?.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error")
      setRecords((prev) => prev.map((r) => r.id === rec.id ? { ...r, activo: !r.activo } : r))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar")
    } finally {
      setToggling(null)
    }
  }
  const handleProcesar = async (rec: AdminRecord, sol: AdminRecord["catalogo_solicitudes"][0]) => {
    setProcesando(sol.id)
    try {
      const partes = sol.nueva_vigencia.split("/").map((s) => s.trim())
      const vi = partes[0] ?? ""
      const vf = partes[1] ?? ""
      const params = new URLSearchParams({ id: String(rec.solicitud.id), sinFirmas: "true" })
      if (vi) params.set("vigenciaInicio", vi)
      if (vf) params.set("vigenciaFin", vf)
      const np = sol.nuevo_numero_personas ?? sol.nuevos_numero_prestadores
      if (np) params.set("numeroPersonas", String(np))

      const pdfRes = await fetch(`/api/pdf/justificacion?${params}`)
      if (!pdfRes.ok) throw new Error("Error al generar el PDF")
      const blob = await pdfRes.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `justificacion-catalogo-${rec.solicitud.folio_dictamen ?? rec.solicitud.folio_recepcion ?? rec.solicitud.id}_${vi}_${vf}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el PDF")
    } finally {
      setProcesando(null)
    }
  }
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar registro…"
          containerClassName="flex-1 max-w-md"
        />
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
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin registros en el catálogo
                  </td>
                </tr>
              )}
              {!loading && records.map((rec) => {
                const hasSols = rec.catalogo_solicitudes.length > 0
                return (
                <tr key={rec.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={entidadNombre(rec)}>
                    {entidadNombre(rec).split(" > ")[0]}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={rec.programa_proyecto}>{fmt(rec.programa_proyecto)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={fmtCapitalize(rec.regimen_contratacion)} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(rec.vigencia)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(rec.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    {hasSols ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-semibold"
                        style={{ backgroundColor: "var(--secondary)", opacity: 0.5 }}
                      >
                        {rec._count.catalogo_solicitudes}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-semibold bg-muted/30 text-muted-foreground">
                        0
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const c = rec.activo ? "#15803d" : "#773357"
                      return (
                        <span
                          className="inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit"
                          style={{ backgroundColor: `${c}18`, color: c }}
                        >
                          {rec.activo ? "Activo" : "Inactivo"}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openReutilizaciones(rec)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
                        aria-label="Ver"
                        title="Ver"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {toggling === rec.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : <Switch
                            checked={rec.activo}
                            onCheckedChange={() => handleToggle(rec)}
                            disabled={toggling === rec.id}
                          />
                      }
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      <Dialog open={showReutilizaciones} onOpenChange={setShowReutilizaciones}>
        <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl bg-white p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-[#E5E7EB]">
            <DialogTitle className="text-base font-semibold text-[#1F2937]">
              Reutilizaciones{viewRec && viewRec.catalogo_solicitudes.length > 0 ? ` (${viewRec.catalogo_solicitudes.length})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto p-4">
            {viewRec && viewRec.catalogo_solicitudes.length > 0 ? (
              <>
                <SearchInput
                  value={reutilizacionesQuery}
                  onChange={(e) => setReutilizacionesQuery(e.target.value)}
                  placeholder="Buscar por usuario o vigencia…"
                  containerClassName="mb-3"
                />
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[40%]" />
                        <col className="w-[35%]" />
                        <col className="w-[25%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Usuario</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reutilizacionesVisibles.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                              Sin resultados para la búsqueda
                            </td>
                          </tr>
                        )}
                        {reutilizacionesVisibles.map((sol) => (
                          <tr key={sol.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3 text-xs font-medium text-card-foreground truncate text-left" title={`${sol.usuario.nombre} (${sol.usuario.rfc})`}>
                              {sol.usuario.nombre}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground truncate text-left">{sol.nueva_vigencia}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground truncate text-left">
                              {new Date(sol.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <TablePagination
                  currentPage={reutilizacionesPage}
                  totalPages={reutilizacionesTotalPages}
                  onPageChange={setReutilizacionesPage}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Sin reutilizaciones registradas.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
export function CatalogoJustificacionesPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === "Administrador"
  return (
    <PageLayout
      title="Catálogo "
      description="Consulta y reutilización de justificaciones dictaminadas previamente."
    >
      {isAdmin ? (
        <Tabs defaultValue="consulta" className="w-full">
          <TabsList>
            <TabsTrigger value="consulta" className="gap-1.5">
              <Search className="h-4 w-4" />
              Consulta
            </TabsTrigger>
            <TabsTrigger value="administracion" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              Administración
            </TabsTrigger>
          </TabsList>
          <TabsContent value="consulta" className="mt-6">
            <ConsultaTab />
          </TabsContent>
          <TabsContent value="administracion" className="mt-6">
            <AdministracionTab />
          </TabsContent>
        </Tabs>
      ) : (
        <ConsultaTab />
      )}
    </PageLayout>
  )
}
