"use client"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { PageLayout } from "@/components/page-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerHabil, dateToIso, isoToDate } from "@/components/ui/date-picker-habil"
import { addMonths } from "date-fns"
import { calcularVigenciaMaxima, esInicioSinRangoValido, MENSAJE_INICIO_31_DIC } from "@/lib/vigencia"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { TOOLTIPS } from "@/lib/tooltips-textos"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {

  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,

} from "@/components/ui/dialog"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileTypeIcon, FileDropZone } from "@/components/ui/file-drop-zone"
import { SearchInput, SEARCH_INPUT_MAX_W_MD, SEARCH_INPUT_MAX_W_SM } from "@/components/ui/search-input"
import { StatusBadge, C_VERDE_ESTADO, C_VERDE_ESTADO_BG, C_ROSA_VINO, C_ROSA_VINO_BG, C_AZUL_REVISION, C_AZUL_REVISION_BG, C_AMARILLO, C_AMARILLO_BG } from "@/components/ui/status-badge"
import {
  Search,
  Loader2,
  Eye,
  ListChecks,
  Send,
  AlertCircle,
  MoreHorizontal,
  Ban,
  Power,
  PowerOff,
  Inbox,
  Upload,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import * as XLSX from "xlsx"
import { COL_LEGACY, SHEET_NAME_LEGACY } from "@/lib/importar-catalogo-excel"
import { folioSinSiglas } from "@/lib/clave-dictamen"
import { SelectConBusqueda } from "@/components/ui/select-con-busqueda"
import { useProgramasSigef } from "@/hooks/use-programas-sigef"
import { useTabulador } from "@/hooks/use-tabulador"
import { buscarRangoTabulador, buscarRangoPorImporte } from "@/lib/tabulador"
import { parseCertificadoInfo } from "@/lib/certificado-cer"
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
    id: number | null
    tipo_solicitud: string
    folio_recepcion: string | null
    folio_dictamen: string | null
    secretaria: string | null
    secretaria_txt_snapshot: string | null
    nivel_tabulador: string | null
    categoria_tabulador: string | null
  }
  _count: { catalogo_solicitudes: number }
}

interface AdminRecord extends CatalogoRecord {
  catalogo_solicitudes: {
    id: number
    nueva_vigencia: string
    nuevo_numero_personas: number | null
    nuevos_numero_prestadores: number | null
    nuevo_importe_bruto: string | null
    programa_anterior: string | null
    nuevo_programa_proyecto: string | null
    tipo: string
    procesado: boolean
    procesado_en: string | null
    solicitud_nueva_id: number | null
    folio_nueva: string | null
    creado_en: string
    usuario: { nombre: string; rfc: string }
  }[]
}
function fmt(val: string | null | undefined) {
  return val ?? "—"
}
function fmtCapitalize(val: string | null | undefined) {
  if (!val) return "—"
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
}
function fmtTipoPago(val: string | null | undefined) {
  if (!val) return "—"
  return val.replace(/_/g, " ")
}
function regimenBadgeColor(raw: string | null | undefined): { color: string; bgColor: string } {
  const r = (raw ?? "").toLowerCase().trim()
  if (r.includes("asimilado")) return { color: C_AZUL_REVISION, bgColor: C_AZUL_REVISION_BG }
  if (r.includes("nombramiento") || r.includes("tiempo determinado")) return { color: C_AMARILLO, bgColor: C_AMARILLO_BG }
  return { color: C_VERDE_ESTADO, bgColor: C_VERDE_ESTADO_BG }
}

function fmtMoney(val: string | null | undefined) {
  if (!val) return "—"
  const n = Number(val)
  if (isNaN(n)) return val
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
}

function parseMoney(str: string): number {
  if (!str) return -1
  const clean = str.replace(/[$,\s]/g, "")
  const n = parseFloat(clean)
  return isNaN(n) ? -1 : n
}
function formatMoneyInput(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, "")
  if (!clean) return ""
  const [intPart, ...rest] = clean.split(".")
  const intFormatted = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const decPart = rest.length > 0 ? "." + rest.join("").slice(0, 2) : ""
  return intFormatted + decPart
}
function entidadNombre(rec: CatalogoRecord) {
  return rec.solicitud.secretaria_txt_snapshot
    ?? rec.solicitud.secretaria
    ?? "—"
}
function maxPrestadoresPermitido(secretaria: string | null | undefined): number {
  const s = (secretaria ?? "").toLowerCase()
  return s.includes("seguridad p") ? 100 : 50
}
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
const PALABRAS_MENORES = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u",
  "en", "a", "al", "con", "por", "para",
])
function toTitleCaseES(input: string): string {
  if (!input) return input
  let wordIndex = 0
  return input.toLocaleLowerCase("es").replace(/[\p{L}\p{N}]+/gu, (word) => {
    const capitalized =
      wordIndex > 0 && PALABRAS_MENORES.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1)
    wordIndex++
    return capitalized
  })
}
const TAB_BADGE = "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-normal bg-[var(--sem-accent-primary)] text-white"
interface ResumenImportExcel {
  totalFilas: number
  yaImportadosCount: number
  listasParaImportar: number
  listasParaActualizar: number
  sinCambioCount: number
  conErrores: number
  sinFolioDictamen: number
  regimenNoReconocido: number
  sinPeriodo: number
  secretariasNoMatch: { nombre: string; count: number }[]
  filasConError: { idx: number; secretariaRaw: string; folioDictamen: string; errores: string[] }[]
  filasConAdvertencia: { idx: number; secretariaRaw: string; folioDictamen: string; advertencias: string[] }[]
  filasParaActualizar: { idx: number; secretariaRaw: string; folioDictamen: string; cambios: { campo: string; anterior: string; nuevo: string }[] }[]
}
interface ResumenObsoletosExcel {
  candidatos: number
  ejemplos: { id: number; folioDictamen: string | null; folioJustificacion: string | null; secretaria: string | null }[]
}
function ConsultaTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
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
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [terminosRec, setTerminosRec]         = useState<CatalogoRecord | null>(null)
  const [showTerminos, setShowTerminos]       = useState(false)
  const [terminosAceptados, setTerminosAceptados] = useState(false)
  const [solRec, setSolRec]       = useState<CatalogoRecord | null>(null)
  const [showSol, setShowSol]     = useState(false)
  const [solVigInicio, setSolVigInicio]     = useState<Date | undefined>(undefined)
  const [solVigFin,    setSolVigFin]        = useState<Date | undefined>(undefined)
  const [solPersonas, setSolPersonas]       = useState("")
  const [solPrestadores, setSolPrestadores] = useState("")
  const [solPrograma, setSolPrograma]       = useState("")
  const [solImporteBruto, setSolImporteBruto] = useState("")

  const [showFirmarSol, setShowFirmarSol]     = useState(false)
  const [solFirmaCargo, setSolFirmaCargo]     = useState("")
  const [solFirmaCargoBloqueado, setSolFirmaCargoBloqueado] = useState(false)
  const [solFirmaCerFile, setSolFirmaCerFile] = useState<File | null>(null)
  const [solNombreCert, setSolNombreCert]     = useState("")
  const [solRfcCert, setSolRfcCert]           = useState("")
  const [solFirmaKeyFile, setSolFirmaKeyFile] = useState<File | null>(null)
  const [solFirmaPassword, setSolFirmaPassword] = useState("")
  const [solLoading, setSolLoading]   = useState(false)
  const [solError, setSolError]       = useState<string | null>(null)
  const [canRec, setCanRec]           = useState<CatalogoRecord | null>(null)
  const [showCan, setShowCan]         = useState(false)
  const [canVigInicio, setCanVigInicio] = useState<Date | undefined>(undefined)
  const [canVigFin,    setCanVigFin]    = useState<Date | undefined>(undefined)
  const [canLoading, setCanLoading]   = useState(false)
  const [canError, setCanError]       = useState<string | null>(null)
  const [canFirmarCatalogo, setCanFirmarCatalogo] = useState(false)

  useEffect(() => {
    if (!user?.id) { setCanFirmarCatalogo(false); return }
    fetch(`/api/catalogo-justificaciones/puede-administrar?userId=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanFirmarCatalogo(d?.puedeFirmar === true))
      .catch(() => {})
  }, [user?.id])
  const progSigef = useProgramasSigef(solRec ? entidadNombre(solRec) : "")
  const solImporteBrutoNum = solImporteBruto.trim() ? parseMoney(solImporteBruto) : null
  const { rangos: rangosTabuladorSol, loading: loadingTabuladorSol } = useTabulador()
  const rangoTabuladorSol = useMemo(() => {
    if (!solRec) return null
    return buscarRangoTabulador(rangosTabuladorSol, solRec.solicitud.nivel_tabulador, solRec.solicitud.categoria_tabulador, entidadNombre(solRec))
  }, [rangosTabuladorSol, solRec])
  // Registros sin nivel/categoría (importados del Excel histórico): el rango se
  // deduce del importe capturado. No se valida contra él — siempre lo contiene.
  const rangoPorImporteSol = useMemo(() => {
    if (!solRec || rangoTabuladorSol) return null
    return buscarRangoPorImporte(rangosTabuladorSol, solImporteBrutoNum, entidadNombre(solRec))
  }, [rangosTabuladorSol, rangoTabuladorSol, solRec, solImporteBrutoNum])
  const importeFueraDeRango =
    rangoTabuladorSol !== null
    && solImporteBrutoNum !== null
    && (solImporteBrutoNum > rangoTabuladorSol.max || solImporteBrutoNum < rangoTabuladorSol.min)
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
  useEffect(() => { onCountChange?.(allRecords.length) }, [allRecords, onCountChange])
  const norm = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  const records = q.trim()
    ? (() => {
        const qNorm = norm(q).replace(/\s+/g, " ").trim()
        return allRecords.filter((r) => {
          const haystack = norm([
            r.programa_proyecto,
            r.tipo_actividad,
            r.denominacion_nombramiento,
            r.vigencia,
            r.regimen_contratacion,
            r.tipo_pago,
            r.importe_bruto,
            r.solicitud.folio_dictamen,
            r.solicitud.secretaria_txt_snapshot,
            r.solicitud.secretaria,
          ].join(" ")).replace(/\s+/g, " ")
          return haystack.includes(qNorm)
        })
      })()
    : allRecords
  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    if (!showView || !viewRec) return
    setPdfBlobUrl(null)
    const controller = new AbortController()
    setPdfLoading(true)
    const pdfParams = viewRec.solicitud.id
      ? `id=${viewRec.solicitud.id}`
      : `catalogoId=${viewRec.id}`
    fetch(`/api/pdf/carta-descriptiva?${pdfParams}`, { signal: controller.signal })
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
  useEffect(() => {
    if (solVigFin && solVigFin > calcularVigenciaMaxima(solVigInicio ?? todayStart)) setSolVigFin(undefined)
  }, [solVigInicio])
  const openView = (rec: CatalogoRecord) => { setViewRec(rec); setShowView(true) }
  const openTerminos = (rec: CatalogoRecord) => {
    setTerminosRec(rec)
    setTerminosAceptados(false)
    setShowTerminos(true)
  }
  const handleAceptarTerminos = () => {
    if (!terminosAceptados || !terminosRec) return
    setShowTerminos(false)
    openSol(terminosRec)
  }
  const openSol  = (rec: CatalogoRecord) => {
    setSolRec(rec)
    setSolVigInicio(todayStart)
    setSolVigFin(undefined)
    setSolPersonas("")
    setSolPrestadores("")
    setSolPrograma(rec.programa_proyecto || "")
    setSolImporteBruto(rec.importe_bruto ? formatMoneyInput(rec.importe_bruto) : "")
    setSolError(null)
    setShowFirmarSol(false)
    setSolFirmaCargo("")
    setSolFirmaCerFile(null)
    setSolFirmaKeyFile(null)
    setSolFirmaPassword("")
    setShowSol(true)
  }

  const handleSolCerFile = async (file: File | null) => {
    setSolFirmaCerFile(file)
    setSolNombreCert(""); setSolRfcCert("")
    if (!file) return
    try {
      const info = parseCertificadoInfo(await file.arrayBuffer())
      if (info.nombre) setSolNombreCert(info.nombre)
      if (info.rfc) setSolRfcCert(info.rfc)
    } catch { /* noop */ }
  }

  const abrirFirmarYGenerar = () => {
    if (!solRec || !user) return
    if (!canFirmarCatalogo) { setSolError("Solo un usuario con rol UEFA o Administrador puede firmar."); return }
    if (!solVigInicio || !solVigFin) { setSolError("La vigencia es requerida"); return }
    if (esInicioSinRangoValido(solVigInicio)) { setSolError(MENSAJE_INICIO_31_DIC); return }
    if (solVigFin > calcularVigenciaMaxima(solVigInicio)) { setSolError("La nueva vigencia no puede exceder 6 meses ni el 31 de diciembre del año en curso"); return }
    if (!isParaestatal(solRec) && solPrestadores) {
      const maxPrestadores = maxPrestadoresPermitido(entidadNombre(solRec))
      if (Number(solPrestadores) > maxPrestadores) {
        setSolError(`El número de prestadores no puede exceder ${maxPrestadores} para esta secretaría`)
        return
      }
    }
    if (importeFueraDeRango && rangoTabuladorSol) {
      setSolError(
        `El importe bruto debe estar entre ${fmtMoney(String(rangoTabuladorSol.min))} y ${fmtMoney(String(rangoTabuladorSol.max))} `
        + `(rango del Tabulador para Nivel ${rangoTabuladorSol.nivel} ${rangoTabuladorSol.categoria})`
      )
      return
    }
    setSolError(null)
    setSolFirmaCargo("")
    setSolFirmaCargoBloqueado(false)
    setSolFirmaCerFile(null)
    setSolNombreCert("")
    setSolRfcCert("")
    setSolFirmaKeyFile(null)
    setSolFirmaPassword("")
    setShowFirmarSol(true)
    fetch(`/api/firma-efirma/ultimo-cargo?usuarioId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.cargo) {
          setSolFirmaCargo(String(j.cargo).toUpperCase())
          setSolFirmaCargoBloqueado(true)
        }
      })
      .catch(() => {})
  }

  const handleFirmarYGenerar = async () => {
    if (!solRec || !user) return
    if (!solFirmaCargo.trim() || !solFirmaCerFile || !solFirmaKeyFile || !solFirmaPassword) {
      setSolError("Completa cargo, .cer, .key y contraseña")
      return
    }
    setSolLoading(true)
    setSolError(null)
    try {
      const vi = dateToIso(solVigInicio!)
      const vf = dateToIso(solVigFin!)
      const npNum = isParaestatal(solRec) ? (solPersonas ? Number(solPersonas) : null) : null
      const nprNum = !isParaestatal(solRec) ? (solPrestadores ? Number(solPrestadores) : null) : null
      const programaCambio =
        solPrograma.trim() !== "" && solPrograma.trim() !== (solRec.programa_proyecto ?? "").trim()
          ? solPrograma.trim()
          : null
      const importeCambio =
        solImporteBrutoNum !== null && solImporteBrutoNum >= 0 ? solImporteBrutoNum : null
      const res = await fetch("/api/catalogo-justificaciones/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogo_justificacion_id: solRec.id,
          usuario_id: user.id,
          nueva_vigencia: `${vi} / ${vf}`,
          nuevo_numero_personas: npNum,
          nuevos_numero_prestadores: nprNum,
          nuevo_importe_bruto: importeCambio,
          programa_anterior: programaCambio ? solRec.programa_proyecto : null,
          nuevo_programa_proyecto: programaCambio,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error ?? "Error al registrar la solicitud")
      }
      const np = isParaestatal(solRec) ? (solPersonas || "") : (solPrestadores || "")
      const [cerB64, keyB64] = await Promise.all([
        fileToBase64(solFirmaCerFile),
        fileToBase64(solFirmaKeyFile),
      ])
      const body: Record<string, unknown> = {
        vigenciaInicio: vi,
        vigenciaFin: vf,
        firmaCargo: solFirmaCargo.trim(),
        firmaUsuarioId: user.id,
        firmaCertificado: cerB64,
        firmaClavePrivada: keyB64,
        firmaFraseClavePrivada: solFirmaPassword,
        nombreCert: solNombreCert,
        rfcCert: solRfcCert,
      }
      if (solRec.solicitud.id) body.solicitudId = solRec.solicitud.id
      else body.catalogoId = solRec.id
      if (np) body.numeroPersonas = np
      if (programaCambio) body.programaProyecto = programaCambio
      if (importeCambio !== null) body.importeBruto = importeCambio
      const pdfRes = await fetch(`/api/pdf/dictamen-prestacion-completo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!pdfRes.ok) {
        const errJson = await pdfRes.json().catch(() => null)
        throw new Error(errJson?.error ?? "Error al generar el PDF")
      }
      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Dictamen_${solRec.solicitud.folio_dictamen ?? solRec.solicitud.folio_recepcion ?? solRec.id}_${vi}_${vf}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setShowFirmarSol(false)
      setShowSol(false)
      void fetchData()
    } catch (e) {
      setSolError(e instanceof Error ? e.message : "Error al generar el PDF")
    } finally {
      setSolLoading(false)
    }
  }
  const openCan = (rec: CatalogoRecord) => {
    setCanRec(rec)
    const inicioActual = rec.vigencia?.split("/")[0]?.trim()
    setCanVigInicio(inicioActual ? isoToDate(inicioActual) : undefined)
    setCanVigFin(undefined)
    setCanError(null)
    setShowCan(true)
  }
  const handleCancelar = async () => {
    if (!canRec || !user) return
    if (!canVigInicio || !canVigFin) { setCanError("La vigencia es requerida"); return }
    if (canVigFin > addMonths(canVigInicio, 6)) { setCanError("La nueva vigencia no puede exceder 6 meses"); return }
    setCanLoading(true)
    setCanError(null)
    try {
      const vi = dateToIso(canVigInicio!)
      const vf = dateToIso(canVigFin!)
      await fetch("/api/catalogo-justificaciones/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogo_justificacion_id: canRec.id,
          usuario_id: user.id,
          nueva_vigencia: `${vi} / ${vf}`,
          tipo: "cancelacion",
        }),
      })
      const params = new URLSearchParams({ vigenciaInicio: vi, vigenciaFin: vf })
      if (canRec.solicitud.id) params.set("id", String(canRec.solicitud.id))
      else params.set("catalogoId", String(canRec.id))
      const pdfRes = await fetch(`/api/pdf/dictamen-prestacion-completo?${params}`)
      if (!pdfRes.ok) throw new Error("Error al generar el PDF")
      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Cancelacion_${canRec.solicitud.folio_dictamen ?? canRec.solicitud.folio_recepcion ?? canRec.id}_${vi}_${vf}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setShowCan(false)
      void fetchData()
    } catch (e) {
      setCanError(e instanceof Error ? e.message : "Error al generar el PDF")
    } finally {
      setCanLoading(false)
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
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])
  const visibleRows   = allVisible.slice((page - 1) * limit, page * limit)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchData()}
          placeholder="Secretaría, Dependencia u Órgano Desconcentrado"
          containerClassName={`flex-1 min-w-[220px] ${SEARCH_INPUT_MAX_W_SM}`}
        />
        <Select value={tipoTab} onValueChange={(v) => { setTipoTab(v as "honorarios" | "nombramiento"); setPage(1) }}>
          <SelectTrigger className="w-auto min-w-72 shrink-0 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="honorarios">Honorarios y Asimilados ({honorarios.length})</SelectItem>
            <SelectItem value="nombramiento">Nombramiento por Tiempo Determinado ({nombramiento.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
      <div className="rounded-2xl bg-background border border-border shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          {tipoTab === "honorarios" ? (
            <table className="w-full">
              <thead>
                <tr>
                  {["Folio de Dictamen", "Programa / Proyecto", "Tipo de Actividad", "Régimen", "Tipo de Pago", "Importe Bruto", "Acciones"].map((h) => (
                    <th key={h} className={h === "Acciones" ? "text-center" : ""}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}><EmptyState icon={Inbox} title="Sin registros de honorarios" description="No se encontraron registros en el catálogo." /></td>
                  </tr>
                )}
                {!loading && visibleRows.map((rec) => (
                  <tr key={rec.id}>
                    <td className="max-w-[200px] truncate font-medium" title={folioSinSiglas(rec.solicitud.folio_dictamen) ?? ""}>
                      {fmt(folioSinSiglas(rec.solicitud.folio_dictamen))}
                    </td>
                    <td className="max-w-[220px] truncate" title={toTitleCaseES(fmt(rec.programa_proyecto))}>
                      {toTitleCaseES(fmt(rec.programa_proyecto))}
                    </td>
                    <td className="max-w-[200px] truncate" title={toTitleCaseES(fmt(rec.tipo_actividad))}>{toTitleCaseES(fmt(rec.tipo_actividad))}</td>
                    <td>
                      <StatusBadge label={fmtCapitalize(rec.regimen_contratacion)} {...regimenBadgeColor(rec.regimen_contratacion)} />
                    </td>
                    <td className="capitalize whitespace-nowrap">{fmtTipoPago(rec.tipo_pago)}</td>
                    <td className="whitespace-nowrap">{fmtMoney(rec.importe_bruto)}</td>
                    <td className="text-center">
                      <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-low border border-border-low transition-colors"
                            aria-label="Acciones"
                          >
                            <MoreHorizontal className="h-4 w-4 text-content-low" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(rec)}>
                            <Eye className="h-4 w-4" /> Ver
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => openTerminos(rec)}>
                            <Send className="h-4 w-4" /> Reutilizar
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem onClick={() => openCan(rec)}>
                            <Ban className="h-4 w-4" /> Cancelación
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {["Folio de Dictamen", "Programa / Proyecto", "Denominación", "Puesto Jefe Inmediato", "Tipo de Actividad", "Personas", "Importe Neto", "Tipo de Pago", "Acciones"].map((h) => (
                    <th key={h} className={h === "Acciones" ? "text-center" : ""}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                )}
                {!loading && visibleRows.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={9}><EmptyState icon={Inbox} title="Sin registros de nombramiento" description="No se encontraron registros en el catálogo." /></td>
                  </tr>
                )}
                {!loading && visibleRows.map((rec) => (
                  <tr key={rec.id}>
                    <td className="max-w-[200px] truncate font-medium" title={folioSinSiglas(rec.solicitud.folio_dictamen) ?? ""}>
                      {fmt(folioSinSiglas(rec.solicitud.folio_dictamen))}
                    </td>
                    <td className="max-w-[200px] truncate" title={toTitleCaseES(fmt(rec.programa_proyecto))}>
                      {toTitleCaseES(fmt(rec.programa_proyecto))}
                    </td>
                    <td className="max-w-[200px] truncate" title={toTitleCaseES(rec.denominacion_nombramiento ?? "")}>
                      {toTitleCaseES(fmt(rec.denominacion_nombramiento))}
                    </td>
                    <td className="max-w-[160px] truncate">{fmt(rec.puesto_jefe_inmediato)}</td>
                    <td title={toTitleCaseES(fmt(rec.tipo_actividad))}>{toTitleCaseES(fmt(rec.tipo_actividad))}</td>
                    <td className="whitespace-nowrap">{rec.numero_personas ?? "—"}</td>
                    <td className="whitespace-nowrap">{fmtMoney(rec.importe_bruto)}</td>
                    <td className="capitalize whitespace-nowrap">{fmtTipoPago(rec.tipo_pago)}</td>
                    <td className="text-center">
                      <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-low border border-border-low transition-colors"
                            aria-label="Acciones"
                          >
                            <MoreHorizontal className="h-4 w-4 text-content-low" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(rec)}>
                            <Eye className="h-4 w-4" /> Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openTerminos(rec)}>
                            <Send className="h-4 w-4" /> Reutilizar
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem onClick={() => openCan(rec)}>
                            <Ban className="h-4 w-4" /> Cancelación
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
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
            <div className="flex items-center justify-center shrink-0">
              <FileTypeIcon name="justificacion.pdf" size="md" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="ds-title-md text-content-high truncate">
                Carta descriptiva
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
          <div className="px-4 pb-4 pt-3 flex justify-end gap-3 border-t border-border shrink-0">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setShowView(false)}
            >
              Cerrar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm"
              onClick={() => { if (viewRec) { setShowView(false); openTerminos(viewRec) } }}
            >
              Solicitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showSol} onOpenChange={setShowSol}>
        <DialogContent className="max-w-lg bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              Generar Dictamen Técnico Funcional
            </DialogTitle>
          </div>
          {solRec && (
            <>
              <div className="flex flex-col gap-4 px-6 py-5">
                <p className="text-xs text-[var(--sem-content-low)]">
                  {isParaestatal(solRec)
                    ? "Ajusta la vigencia, el número de personas y, si aplica, el Programa o Proyecto. Se descargará el PDF del dictamen sin firmas."
                    : "Ajusta la vigencia, el número de prestadores de servicio y, si aplica, el Programa o Proyecto. Se descargará el PDF del dictamen sin firmas."}
                </p>
                <div className="rounded-lg px-4 py-3 text-xs space-y-1 bg-[var(--sem-support-disabled-low)] border border-[var(--sem-border-md)]">
                  <p className="font-semibold text-[#1F2937]">{entidadNombre(solRec)}</p>
                  <p className="text-[var(--sem-content-low)]">{fmt(solRec.programa_proyecto)}</p>
                  <p className="text-[var(--sem-content-low)]">
                    Vigencia actual:{" "}
                    <span className="font-medium text-[#1F2937]">{fmt(solRec.vigencia)}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Nueva vigencia
                    <InfoTooltip text={TOOLTIPS.VIGENCIA} />
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Inicio</span>
                      <DatePickerHabil
                        value={solVigInicio ?? todayStart}
                        onChange={(d) => setSolVigInicio(d)}
                        fromDate={todayStart}
                        placeholder="Seleccionar inicio"
                        className={solVigInicio && esInicioSinRangoValido(solVigInicio) ? "border-destructive" : ""}
                      />
                      {solVigInicio && esInicioSinRangoValido(solVigInicio) && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />{MENSAJE_INICIO_31_DIC}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Término</span>
                      <DatePickerHabil
                        value={solVigFin}
                        fromDate={solVigInicio ?? todayStart}
                        toDate={calcularVigenciaMaxima(solVigInicio ?? todayStart)}
                        onChange={(d) => setSolVigFin(d)}
                        placeholder="Seleccionar término"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-content-high flex items-center gap-1.5">
                    Programa / Proyecto
                  </span>
                  {progSigef.configured && progSigef.proyectos.length > 0 ? (
                    <SelectConBusqueda
                      opciones={progSigef.proyectos}
                      value={solPrograma}
                      onValueChange={setSolPrograma}
                      placeholder={progSigef.cargando ? "Cargando programas de SIGeF…" : "Seleccione programa"}
                      disabled={progSigef.cargando || solLoading}
                    />
                  ) : progSigef.cargando ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-base px-3 py-2 min-h-9">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando programas de SIGeF…</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-content-high px-3 py-2 rounded-xl border border-border bg-bg-base">
                        {toTitleCaseES(fmt(solRec.programa_proyecto))}
                      </p>
                      <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        <span className="text-xs text-destructive">
                          {progSigef.error
                            ? `No se pudo cargar el catálogo de SIGeF. (${progSigef.error}) Se mantendrá el Programa/Proyecto actual.`
                            : "No hay programas o proyectos de SIGeF disponibles para esta Secretaría. Se mantendrá el Programa/Proyecto actual."}
                        </span>
                      </div>
                    </>
                  )}
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
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        Núm. prestadores de servicio
                        <span className="font-normal text-muted-foreground">
                          (máx. {maxPrestadoresPermitido(entidadNombre(solRec))})
                        </span>
                        <InfoTooltip text={TOOLTIPS.MAX_PRESTADORES} />
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxPrestadoresPermitido(entidadNombre(solRec))}
                        placeholder="—"
                        value={solPrestadores}
                        onChange={(e) => setSolPrestadores(e.target.value)}
                        disabled={solLoading}
                        className={
                          Number(solPrestadores || 0) > maxPrestadoresPermitido(entidadNombre(solRec))
                            ? "bg-background border-destructive focus-visible:border-destructive"
                            : "bg-background"
                        }
                      />
                      {Number(solPrestadores || 0) > maxPrestadoresPermitido(entidadNombre(solRec)) && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          No puede exceder {maxPrestadoresPermitido(entidadNombre(solRec))} prestadores para esta secretaría
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0">Importe Bruto</span>
                    {rangoTabuladorSol ? (
                      <span className="font-normal text-muted-foreground">
                        (Nivel {rangoTabuladorSol.nivel} · Categoría {rangoTabuladorSol.categoria} — rango tabulador: {fmtMoney(String(rangoTabuladorSol.min))} a {fmtMoney(String(rangoTabuladorSol.max))})
                      </span>
                    ) : rangoPorImporteSol ? (
                      <span className="font-normal text-muted-foreground">
                        (Nivel {rangoPorImporteSol.nivel} · Categoría {rangoPorImporteSol.categoria} — rango tabulador: {fmtMoney(String(rangoPorImporteSol.min))} a {fmtMoney(String(rangoPorImporteSol.max))})
                      </span>
                    ) : solImporteBrutoNum !== null && !loadingTabuladorSol ? (
                      <span className="font-normal text-muted-foreground">
                        (El importe no corresponde a ningún rango del tabulador {new Date().getFullYear()})
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    type="text"
                    placeholder={solRec ? `$${solRec.importe_bruto ?? "0.00"}` : "$0.00"}
                    value={solImporteBruto}
                    onChange={(e) => setSolImporteBruto(e.target.value)}
                    onBlur={() => setSolImporteBruto((v) => formatMoneyInput(v))}
                    disabled={solLoading}
                    className={
                      importeFueraDeRango
                         ? "bg-background border-destructive focus-visible:border-destructive"
                        : "bg-background"
                    }
                  />
                  {importeFueraDeRango && rangoTabuladorSol && (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Debe estar entre {fmtMoney(String(rangoTabuladorSol.min))} y {fmtMoney(String(rangoTabuladorSol.max))} según el Tabulador (Nivel {rangoTabuladorSol.nivel} · Categoría {rangoTabuladorSol.categoria})
                    </div>
                  )}
                </div>
                {!canFirmarCatalogo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Solo un usuario con rol UEFA o Administrador puede firmar la reutilización.
                  </div>
                )}
                {solError && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />{solError}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
                <Button
                  variant="default"
                  className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
                  onClick={() => setShowSol(false)}
                  disabled={solLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="vino"
                  className="rounded-full h-10 px-6 font-normal shadow-sm"
                  onClick={abrirFirmarYGenerar}
                  disabled={
                    solLoading ||
                    !canFirmarCatalogo ||
                    !solVigInicio ||
                    !solVigFin ||
                    esInicioSinRangoValido(solVigInicio) ||
                    (!isParaestatal(solRec) && Number(solPrestadores || 0) > maxPrestadoresPermitido(entidadNombre(solRec))) ||
                    importeFueraDeRango
                  }
                  title={!canFirmarCatalogo ? "Solo un usuario con rol UEFA o Administrador puede firmar." : undefined}
                >
                  {solLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {solLoading ? "Generando…" : "Generar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showFirmarSol} onOpenChange={(v) => { if (!v && !solLoading) setShowFirmarSol(false) }}>
        <DialogContent className="max-w-xl bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              Firmar Dictamen Técnico Funcional
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              El Dictamen se emite con firma electrónica. Complete sus credenciales de e.firma.
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-2">
              <Label className="text-xs flex items-center gap-1">Cargo / Puesto</Label>
              <Input
                value={solFirmaCargo}
                readOnly={solFirmaCargoBloqueado}
                onChange={(e) => { if (!solFirmaCargoBloqueado) setSolFirmaCargo(e.target.value.toUpperCase()) }}
                placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                className={`uppercase bg-background ${solFirmaCargoBloqueado ? "cursor-not-allowed" : ""}`}
                disabled={solLoading}
              />
              {solFirmaCargoBloqueado && (
                <p className="text-[10px] text-muted-foreground">
                  Cargo tomado de tu usuario — no puede editarse aquí.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Certificado (.cer)</Label>
                <Input
                  type="file" accept=".cer"
                  onChange={(e) => void handleSolCerFile(e.target.files?.[0] ?? null)}
                  disabled={solLoading}
                />
                {solFirmaCerFile && <span className="text-xs text-muted-foreground truncate">{solFirmaCerFile.name}</span>}
                {solNombreCert && (
                  <p className="text-[10px] text-muted-foreground">
                    Firmará como: <strong>{solNombreCert}</strong>{solRfcCert ? ` (${solRfcCert})` : ""} — extraído del certificado
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Clave privada (.key)</Label>
                <Input
                  type="file" accept=".key"
                  onChange={(e) => setSolFirmaKeyFile(e.target.files?.[0] ?? null)}
                  disabled={solLoading}
                />
                {solFirmaKeyFile && <span className="text-xs text-muted-foreground truncate">{solFirmaKeyFile.name}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Contraseña de la clave privada</Label>
              <Input
                type="password"
                value={solFirmaPassword}
                onChange={(e) => setSolFirmaPassword(e.target.value)}
                autoComplete="new-password"
                disabled={solLoading}
              />
            </div>
            {solError && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />{solError}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setShowFirmarSol(false)}
              disabled={solLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm"
              onClick={handleFirmarYGenerar}
              disabled={solLoading || !solFirmaCargo.trim() || !solFirmaCerFile || !solFirmaKeyFile || !solFirmaPassword}
            >
              {solLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {solLoading ? "Firmando…" : "Firmar y Generar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showCan} onOpenChange={setShowCan}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              Generar cancelación
            </DialogTitle>
          </div>
          {canRec && (
            <>
              <div className="flex flex-col gap-4 px-6 py-5">
                <p className="text-xs text-[var(--sem-content-low)]">
                  Ajusta únicamente la vigencia. Se generará el documento de cancelación (carta descriptiva y dictamen) tomando como base esta justificación.
                </p>
                <div className="rounded-lg px-4 py-3 text-xs space-y-1 bg-[var(--sem-support-disabled-low)] border border-[var(--sem-border-md)]">
                  <p className="font-semibold text-[#1F2937]">{entidadNombre(canRec)}</p>
                  <p className="text-[var(--sem-content-low)]">{fmt(canRec.programa_proyecto)}</p>
                  <p className="text-[var(--sem-content-low)]">
                    Vigencia actual:{" "}
                    <span className="font-medium text-[#1F2937]">{fmt(canRec.vigencia)}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Nueva vigencia
                    <InfoTooltip text={TOOLTIPS.VIGENCIA} />
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Inicio</span>
                      <DatePickerHabil
                        value={canVigInicio}
                        onChange={(d) => setCanVigInicio(d)}
                        disabled
                        placeholder="Seleccionar inicio"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Término</span>
                      <DatePickerHabil
                        value={canVigFin}
                        fromDate={canVigInicio}
                        toDate={canVigInicio ? addMonths(canVigInicio, 6) : undefined}
                        onChange={(d) => setCanVigFin(d)}
                        placeholder="Seleccionar término"
                      />
                    </div>
                  </div>
                </div>
                {canError && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />{canError}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
                <Button
                  variant="default"
                  className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
                  onClick={() => setShowCan(false)}
                  disabled={canLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="vino"
                  className="rounded-full h-10 px-6 font-normal shadow-sm"
                  onClick={handleCancelar}
                  disabled={canLoading || !canVigInicio || !canVigFin}
                >
                  {canLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {canLoading ? "Generando…" : "Generar cancelación"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showTerminos} onOpenChange={(v) => { setShowTerminos(v); if (!v) setTerminosRec(null) }}>
        <DialogContent className="max-w-lg bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              Términos y condiciones
            </DialogTitle>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Antes de reutilizar este registro del catálogo, lee y acepta los términos y condiciones aplicables a la generación de una nueva solicitud a partir de esta justificación.
            </p>
            <div className="rounded-lg border border-[var(--sem-border-md)] bg-[#f9f8f5] px-4 py-3 max-h-48 overflow-y-auto text-sm text-content-high leading-relaxed">
              <strong>Nota:</strong> Previamente al elegir la Carta Descriptiva que considere alineada a las necesidades de contratación de prestadores de servicios profesionales, deberá contar con el oficio de suficiencia presupuestal correspondiente.
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={terminosAceptados}
                onCheckedChange={(v) => setTerminosAceptados(v === true)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm text-content-high">
                He leído y acepto los <span className="font-medium text-[var(--sem-accent-primary)]">términos y condiciones</span>
              </span>
            </label>
          </div>
          <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm"
              onClick={handleAceptarTerminos}
              disabled={!terminosAceptados}
            >
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdministracionTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [q, setQ]               = useState("")
  const [secretariaFilter, setSecretariaFilter] = useState("todas")
  const [page, setPage]         = useState(1)
  const [allRecords, setAllRecords] = useState<AdminRecord[]>([])
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
  const esCancelacion = (sol: AdminRecord["catalogo_solicitudes"][0]) => sol.tipo === "cancelacion"
  const esPrograma = (sol: AdminRecord["catalogo_solicitudes"][0]) => sol.tipo === "programa"
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
  useEffect(() => { if (reutilizacionesPage > reutilizacionesTotalPages) setReutilizacionesPage(reutilizacionesTotalPages) }, [reutilizacionesTotalPages, reutilizacionesPage])

  const [importOpen, setImportOpen]           = useState(false)
  const [importFiles, setImportFiles]         = useState<File[]>([])
  const [importPreview, setImportPreview]     = useState<{ formatoLabel: string; resumen: ResumenImportExcel; obsoletos: ResumenObsoletosExcel | null } | null>(null)
  const [importPreviewLoading, setImportPreviewLoading] = useState(false)
  const [importError, setImportError]         = useState<string | null>(null)
  const [importCommitLoading, setImportCommitLoading]   = useState(false)
  const [importResult, setImportResult]       = useState<{ creadas: number; actualizadas: number; eliminadas: number; sincronizacion: { insertados: number } } | null>(null)
  const [importActualizarExistentes, setImportActualizarExistentes] = useState(false)
  const [importReemplazarAnterior, setImportReemplazarAnterior]     = useState(false)

  const resetImportDialog = () => {
    setImportFiles([])
    setImportPreview(null)
    setImportError(null)
    setImportResult(null)
    setImportPreviewLoading(false)
    setImportCommitLoading(false)
    setImportActualizarExistentes(false)
    setImportReemplazarAnterior(false)
  }

  const handleImportFilesChange = async (
    files: File[],
    actualizarExistentes = importActualizarExistentes,
    reemplazarAnterior = importReemplazarAnterior,
  ) => {
    setImportFiles(files)
    setImportPreview(null)
    setImportError(null)
    setImportResult(null)
    if (files.length === 0 || !user) return
    setImportPreviewLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", files[0])
      fd.append("userId", user.id)
      fd.append("actualizarExistentes", actualizarExistentes ? "true" : "false")
      fd.append("reemplazarAnterior", reemplazarAnterior ? "true" : "false")
      const res = await fetch("/api/catalogo-justificaciones/importar/preview", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al leer el archivo")
      setImportPreview(data)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error al leer el archivo")
    } finally {
      setImportPreviewLoading(false)
    }
  }

  const handleImportActualizarExistentesChange = (v: boolean) => {
    setImportActualizarExistentes(v)
    if (importFiles.length > 0) void handleImportFilesChange(importFiles, v, importReemplazarAnterior)
  }

  const handleImportReemplazarAnteriorChange = (v: boolean) => {
    setImportReemplazarAnterior(v)
    if (importFiles.length > 0) void handleImportFilesChange(importFiles, importActualizarExistentes, v)
  }

  const handleImportCommit = async () => {
    if (importFiles.length === 0 || !user) return
    setImportCommitLoading(true)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append("file", importFiles[0])
      fd.append("userId", user.id)
      fd.append("actualizarExistentes", importActualizarExistentes ? "true" : "false")
      fd.append("reemplazarAnterior", importReemplazarAnterior ? "true" : "false")
      const res = await fetch("/api/catalogo-justificaciones/importar/commit", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al importar el archivo")
      setImportResult(data)
      await fetchData()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error al importar el archivo")
    } finally {
      setImportCommitLoading(false)
    }
  }

  const fetchData = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: "1", limit: "all", userId: user?.id ?? "" })
      const res = await fetch(`/api/catalogo-justificaciones/admin?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar datos")
      const data = await res.json()
      setAllRecords(data.records)
      onCountChange?.(data.total)
      hasDataRef.current = true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [user?.id])
  useEffect(() => { void fetchData() }, [fetchData])
  useRealtime(["catalogo"], fetchData)
  const [confirmToggle, setConfirmToggle] = useState<AdminRecord | null>(null)

  const [secretariasCanonicas, setSecretariasCanonicas] = useState<string[]>([])
  useEffect(() => {
    fetch("/api/catalogo/centralizada")
      .then((r) => (r.ok ? r.json() : []))
      .then((tree: { nombre: string; tipo: string | null }[]) => {
        setSecretariasCanonicas(
          tree.filter((n) => n.tipo === "SECRETARIA").map((n) => n.nombre),
        )
      })
      .catch(() => {})
  }, [])

  const handleToggle = async (rec: AdminRecord) => {
    setToggling(rec.id)
    try {
      const res = await fetch(`/api/catalogo-justificaciones/${rec.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !rec.activo, userId: user?.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error")
      setAllRecords((prev) => prev.map((r) => r.id === rec.id ? { ...r, activo: !r.activo } : r))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar")
    } finally {
      setToggling(null)
    }
  }
  const handleProcesar = async (rec: AdminRecord, sol: AdminRecord["catalogo_solicitudes"][0]) => {
    if (!rec.solicitud.id) {
      setError("No se puede procesar: la solicitud original ya no existe (registro histórico).")
      return
    }
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

  const reporteRows = (records: AdminRecord[]): (string | number)[][] => [
    ["Secretaría / Dependencia", "Folio de Dictamen", "Programa / Proyecto", "Régimen", "Vigencia", "Creado", "Movimientos", "Estado"],
    ...records.map((rec) => [
      toTitleCaseES(entidadNombre(rec).split(" > ")[0]),
      fmt(folioSinSiglas(rec.solicitud.folio_dictamen)),
      toTitleCaseES(fmt(rec.programa_proyecto)),
      fmtCapitalize(rec.regimen_contratacion),
      fmt(rec.vigencia),
      new Date(rec.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
      rec._count.catalogo_solicitudes,
      rec.activo ? "Activo" : "Inactivo",
    ]),
  ]

  const reutilizacionRows = (records: AdminRecord[]): (string | number)[][] => [
    ["Folio de Dictamen", "Secretaría / Dependencia", "Programa / Proyecto", "Usuario", "Vigencia", "Núm. Prestadores", "Programa o Proyecto (movimiento)", "Importe Bruto (movimiento)", "Creado"],
    ...records.flatMap((rec) =>
      rec.catalogo_solicitudes.map((sol) => [
        fmt(folioSinSiglas(rec.solicitud.folio_dictamen)),
        toTitleCaseES(entidadNombre(rec).split(" > ")[0]),
        toTitleCaseES(fmt(rec.programa_proyecto)),
        sol.usuario.nombre,
        sol.nueva_vigencia,
        esCancelacion(sol) ? "—" : (sol.nuevo_numero_personas ?? sol.nuevos_numero_prestadores ?? "—"),
        sol.nuevo_programa_proyecto ?? rec.programa_proyecto ?? "—",
        esCancelacion(sol) ? "—" : fmtMoney(sol.nuevo_importe_bruto ?? rec.importe_bruto ?? null),
        new Date(sol.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
      ]),
    ),
  ]

  const addSheetFromRows = (wb: XLSX.WorkBook, rows: (string | number)[][], nombreHoja: string) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = rows[0].map((_, c) =>
      ({ wch: Math.min(50, Math.max(12, ...rows.map((r) => String(r[c] ?? "").length))) }),
    )
    ws["!autofilter"] = { ref: ws["!ref"]! }
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  }

  const buildReporteWorkbook = (records: AdminRecord[]) => {
    const wb = XLSX.utils.book_new()
    addSheetFromRows(wb, reporteRows(records), "Catálogo")
    return wb
  }

  const handleReporte = (rec: AdminRecord) => {
    const wb = buildReporteWorkbook([rec])
    const folio = rec.solicitud.folio_dictamen ?? rec.solicitud.folio_recepcion ?? String(rec.id)
    XLSX.writeFile(wb, `reporte-reutilizaciones-${folio}.xlsx`, { bookType: "xlsx", type: "binary" })
  }

  const handleReporteGeneral = () => {
    const conMovimientos = filtered.filter((rec) => rec.catalogo_solicitudes.length > 0)
    const sinMovimientos = filtered.filter((rec) => rec.catalogo_solicitudes.length === 0)
    const wb = XLSX.utils.book_new()
    addSheetFromRows(wb, reporteRows(sinMovimientos), "General")
    addSheetFromRows(wb, reutilizacionRows(conMovimientos), "Con Movimientos")

    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `reporte-general-catalogo-${fecha}.xlsx`, { bookType: "xlsx", type: "binary" })
  }

  const handleDescargarPlantilla = () => {
    const headers = Object.values(COL_LEGACY)
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME_LEGACY)
    XLSX.writeFile(wb, "plantilla-catalogo-justificaciones.xlsx", { bookType: "xlsx", type: "binary" })
  }

  const norm = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  const secretariaDe = (rec: AdminRecord) => entidadNombre(rec).split(">")[0].trim()
  const secretariaClave = (rec: AdminRecord) => norm(secretariaDe(rec)).replace(/\s+/g, " ")
  const secretarias = useMemo(
    () => secretariasCanonicas
      .map((nombre) => [norm(nombre).replace(/\s+/g, " "), nombre] as const),
    [secretariasCanonicas],
  )
  const filtered = useMemo(() => {
    let list = allRecords
    if (secretariaFilter !== "todas") {
      list = list.filter((r) => secretariaClave(r) === secretariaFilter)
    }
    const qNorm = norm(q).replace(/\s+/g, " ").trim()
    if (qNorm) {
      list = list.filter((r) => {
        const haystack = norm([
          r.programa_proyecto,
          r.tipo_actividad,
          r.denominacion_nombramiento,
          r.vigencia,
          r.regimen_contratacion,
          r.tipo_pago,
          r.importe_bruto,
          r.solicitud.folio_dictamen,
          r.solicitud.secretaria_txt_snapshot,
          r.solicitud.secretaria,
        ].join(" ")).replace(/\s+/g, " ")
        return haystack.includes(qNorm)
      })
    }
    return list
  }, [allRecords, q, secretariaFilter])
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])
  useEffect(() => { setPage(1) }, [q, secretariaFilter])
  const visibleRows = filtered.slice((page - 1) * limit, page * limit)
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por dependencia, programa, folio…"
          containerClassName={`flex-1 min-w-[220px] ${SEARCH_INPUT_MAX_W_MD}`}
        />
        <Select value={secretariaFilter} onValueChange={setSecretariaFilter}>
          <SelectTrigger className="w-80 bg-card">
            <SelectValue placeholder="Todas las Secretarías / Dependencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las Secretarías / Dependencia</SelectItem>
            {secretarias.map(([clave, nombre]) => (
              <SelectItem key={clave} value={clave}>{nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="default"
          className="gap-1.5 shrink-0"
          onClick={handleReporteGeneral}
          disabled={filtered.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Reporte general
        </Button>

        {/*<Button
          variant="vino"
          className="gap-1.5 shrink-0"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Importar Excel al catálogo
        </Button>*/}

        {/* Comentado a pedido: el reporte "General" ya separa por hojas
            (General + Con Movimientos), así que esta opción de menú quedó
            redundante. Se deja el handler por si se reactiva.
        <DropdownMenuItem
          onClick={handleReporteReutilizaciones}
          disabled={!filtered.some((rec) => rec.catalogo_solicitudes.length > 0)}
        >
          <FileSpreadsheet className="h-4 w-4" /> Reporte Reutilizaciones
        </DropdownMenuItem>
        */}
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Secretaría / Dependencia</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Folio de Dictamen</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Programa / Proyecto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Régimen</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Creado</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Movimientos</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={9}><EmptyState icon={Inbox} title="Sin registros en el catálogo" description="No se encontraron registros." /></td>
                </tr>
              )}
              {!loading && visibleRows.map((rec) => {
                const hasSols = rec.catalogo_solicitudes.length > 0
                return (
                <tr key={rec.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={toTitleCaseES(entidadNombre(rec))}>
                    {toTitleCaseES(entidadNombre(rec).split(" > ")[0])}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate font-medium" title={folioSinSiglas(rec.solicitud.folio_dictamen) ?? ""}>{fmt(folioSinSiglas(rec.solicitud.folio_dictamen))}</td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" title={toTitleCaseES(fmt(rec.programa_proyecto))}>{toTitleCaseES(fmt(rec.programa_proyecto))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={fmtCapitalize(rec.regimen_contratacion)} {...regimenBadgeColor(rec.regimen_contratacion)} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(rec.vigencia)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(rec.creado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    {hasSols ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-semibold text-white"
                        style={{ backgroundColor: "var(--secondary)" }}
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
                    {rec.activo ? (
                      <StatusBadge label="Activo" />
                    ) : (
                      <StatusBadge label="Inactivo" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {toggling === rec.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-low border border-border-low transition-colors"
                            aria-label="Acciones"
                          >
                            <MoreHorizontal className="h-4 w-4 text-content-low" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openReutilizaciones(rec)}>
                            <Eye className="h-4 w-4" /> Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReporte(rec)}
                            disabled={rec.catalogo_solicitudes.length === 0}
                          >
                            <FileSpreadsheet className="h-4 w-4" /> Reporte
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirmToggle(rec)} disabled={toggling === rec.id}>
                            {rec.activo
                              ? <><PowerOff className="h-4 w-4" /> Desactivar</>
                              : <><Power className="h-4 w-4" /> Activar</>
                            }
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        <DialogContent className="w-[90vw] max-w-6xl sm:max-w-6xl bg-white p-0 gap-0 overflow-hidden [&>button]:top-2">
          <DialogHeader className="px-5 py-4 border-b border-[var(--sem-border-md)]">
            <div className="flex items-center justify-between gap-3 pr-10">
              <DialogTitle className="ds-title-md text-content-high">
                Reutilizaciones {viewRec && viewRec.catalogo_solicitudes.length > 0 ? ` (${viewRec.catalogo_solicitudes.length})` : ""}
              </DialogTitle>
              {viewRec && viewRec.catalogo_solicitudes.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground shrink-0">
                  Prestadores de Servicio: {viewRec.catalogo_solicitudes.reduce(
                    (sum, s) => sum + (esCancelacion(s) ? 0 : (s.nuevo_numero_personas ?? s.nuevos_numero_prestadores ?? 0)),
                    0,
                  )}
                  {/* {" · "}Cancelaciones: {viewRec.catalogo_solicitudes.filter(esCancelacion).length}
                  {" · "}Programa: {viewRec.catalogo_solicitudes.filter(esPrograma).length} */}
                </span>
              )}
            </div>
            {viewRec && (
              <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-content-high">{toTitleCaseES(entidadNombre(viewRec))}</span>
                <span>{fmt(viewRec.programa_proyecto)}</span>
                <span>Vigencia actual: {fmt(viewRec.vigencia)}</span>
              </div>
            )}
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto p-4">
            {viewRec && viewRec.catalogo_solicitudes.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <SearchInput
                    value={reutilizacionesQuery}
                    onChange={(e) => setReutilizacionesQuery(e.target.value)}
                    placeholder="Buscar por usuario o vigencia…"
                    containerClassName="flex-1"
                  />
                </div>
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        {/* <col className="w-[13%]" /> */}
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[12%]" />
                        <col className="w-[26%]" />
                        <col className="w-[14%]" />
                        <col className="w-[16%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="px-4 py-2.5 pr-6 text-left text-xs font-semibold text-muted-foreground">Usuario</th>
                          <th className="px-4 py-2.5 pr-6 text-left text-xs font-semibold text-muted-foreground">Vigencia</th>
                          <th className="px-4 py-2.5 pr-10 text-left text-xs font-semibold text-muted-foreground">Núm. Prestadores</th>
                          <th className="px-4 py-2.5 pr-6 text-left text-xs font-semibold text-muted-foreground">Programa o Proyecto</th>
                          <th className="px-4 py-2.5 pr-6 text-left text-xs font-semibold text-muted-foreground">Importe Bruto</th>
                          <th className="px-4 py-2.5 pr-6 text-left text-xs font-semibold text-muted-foreground">Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reutilizacionesVisibles.length === 0 && (
                          <tr className="empty-row">
                            <td colSpan={6}>
                              <EmptyState icon={Inbox} title="Sin resultados" description="Ajusta los filtros para ver más resultados." />
                            </td>
                          </tr>
                        )}
                        {reutilizacionesVisibles.map((sol) => (
                          <tr key={sol.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                            {/* <td className="px-4 py-3 text-left">
                              {esCancelacion(sol)
                                ? <StatusBadge label="Cancelación" color={C_ROSA_VINO} bgColor={C_ROSA_VINO_BG} />
                                : esPrograma(sol)
                                ? <StatusBadge label="Programa" color={C_AMARILLO} bgColor={C_AMARILLO_BG} />
                                : <StatusBadge label="Reutilización" color={C_AZUL_REVISION} bgColor={C_AZUL_REVISION_BG} />}
                            </td> */}
                            <td className="px-4 py-3 pr-6 text-xs font-medium text-card-foreground text-left" title={`${sol.usuario.nombre} (${sol.usuario.rfc})`}>
                              {sol.usuario.nombre}
                            </td>
                            <td className="px-4 py-3 pr-6 text-xs text-muted-foreground text-left whitespace-nowrap">{sol.nueva_vigencia}</td>
                            <td className="px-4 py-3 pr-6 text-xs text-muted-foreground truncate text-left">
                              {esCancelacion(sol) ? "—" : (sol.nuevo_numero_personas ?? sol.nuevos_numero_prestadores ?? "—")}
                            </td>
                            <td className="px-4 py-3 pr-6 text-xs text-muted-foreground break-words text-left">
                              {sol.nuevo_programa_proyecto ?? viewRec?.programa_proyecto ?? "—"}
                            </td>
                            <td className="px-4 py-3 pr-6 text-xs text-muted-foreground truncate text-left">
                              {esCancelacion(sol) ? "—" : fmtMoney(sol.nuevo_importe_bruto ?? viewRec?.importe_bruto ?? null)}
                            </td>
                            <td className="px-4 py-3 pr-6 text-xs text-muted-foreground truncate text-left">
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
              <EmptyState icon={Inbox} title="Sin movimientos registrados" description="Aún no hay reutilizaciones ni cancelaciones para este registro." />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => { if (confirmToggle) { handleToggle(confirmToggle); setConfirmToggle(null) } }}
        variant={confirmToggle?.activo ? "eliminar" : "default"}
        title={confirmToggle?.activo ? "¿Desactivar registro?" : "¿Activar registro?"}
        description={confirmToggle?.activo
          ? "El registro dejará de estar disponible para reutilización en nuevas solicitudes."
          : "El registro estará disponible nuevamente para reutilización en nuevas solicitudes."}
        confirmLabel={confirmToggle?.activo ? "Sí, desactivar" : "Sí, activar"}
      />
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) resetImportDialog() }}>
        <DialogContent className="max-w-lg bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              Importar Excel al catálogo
            </DialogTitle>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
            {importResult ? (
              <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-green-500 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span className="text-sm text-green-700">
                  Se crearon <strong>{importResult.creadas}</strong> solicitud{importResult.creadas !== 1 ? "es" : ""}
                  {importResult.actualizadas > 0 && <> y se actualizaron <strong>{importResult.actualizadas}</strong> existente{importResult.actualizadas !== 1 ? "s" : ""}</>}
                  {" "}y se sincronizaron <strong>{importResult.sincronizacion.insertados}</strong> registro{importResult.sincronizacion.insertados !== 1 ? "s" : ""} en el catálogo.
                  {importResult.eliminadas > 0 && <> Se eliminaron <strong>{importResult.eliminadas}</strong> registro{importResult.eliminadas !== 1 ? "s" : ""} de importaciones anteriores que ya no vienen en este archivo.</>}
                </span>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sube un archivo <span className="font-semibold text-card-foreground">.xlsx</span> con justificaciones dictaminadas (formato consolidado de una sola hoja, o una hoja por secretaría). Primero se muestra una vista previa sin guardar nada; tú confirmas antes de escribir en la base de datos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 self-start"
                  onClick={handleDescargarPlantilla}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Descargar plantilla
                </Button>
                <FileDropZone
                  accept=".xlsx"
                  hint=".xlsx · máx. 10 MB"
                  multiple={false}
                  files={importFiles}
                  onFilesChange={handleImportFilesChange}
                  loading={importPreviewLoading}
                  loadingText="Leyendo y validando archivo..."
                  disabled={importCommitLoading}
                />
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <Checkbox
                    checked={importActualizarExistentes}
                    onCheckedChange={(v) => handleImportActualizarExistentesChange(v === true)}
                    className="mt-0.5 shrink-0"
                    disabled={importCommitLoading || importPreviewLoading}
                  />
                  <span className="text-xs text-content-high leading-relaxed">
                    Actualizar registros existentes con la información del Excel si algo cambió (folio ya en el catálogo con datos distintos). Si el folio ya existe y no cambió nada, se deja igual.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <Checkbox
                    checked={importReemplazarAnterior}
                    onCheckedChange={(v) => handleImportReemplazarAnteriorChange(v === true)}
                    className="mt-0.5 shrink-0"
                    disabled={importCommitLoading || importPreviewLoading}
                  />
                  <span className="text-xs text-content-high leading-relaxed">
                    Reemplazar importación anterior: elimina las solicitudes que vinieron de un Excel importado antes y que ya no aparecen en este archivo (folio distinto). Las solicitudes creadas por el flujo normal del sistema nunca se tocan.
                  </span>
                </label>
                {importError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{importError}
                  </p>
                )}
                {importPreview && (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border border-[var(--color-core-piedra-90)] bg-[#f9f8f5] px-4 py-3 text-xs space-y-1">
                      <p className="text-content-high">Formato detectado: <strong>{importPreview.formatoLabel}</strong></p>
                      <p className="text-content-high">Total de filas con datos: <strong>{importPreview.resumen.totalFilas}</strong></p>
                      <p className="text-green-700">Listas para importar: <strong>{importPreview.resumen.listasParaImportar}</strong></p>
                      {importActualizarExistentes && importPreview.resumen.listasParaActualizar > 0 && (
                        <p className="text-blue-700">Se actualizarán (folio ya existente con datos distintos): <strong>{importPreview.resumen.listasParaActualizar}</strong></p>
                      )}
                      {importActualizarExistentes && importPreview.resumen.sinCambioCount > 0 && (
                        <p className="text-muted-foreground">Ya estaban igual, no se tocan: <strong>{importPreview.resumen.sinCambioCount}</strong></p>
                      )}
                      {importPreview.resumen.yaImportadosCount > 0 && (
                        <p className="text-muted-foreground">Ya estaban en el catálogo (se omiten): <strong>{importPreview.resumen.yaImportadosCount}</strong></p>
                      )}
                      {importPreview.resumen.conErrores > 0 && (
                        <p className="text-destructive">Con errores (se omiten): <strong>{importPreview.resumen.conErrores}</strong></p>
                      )}
                      {importReemplazarAnterior && importPreview.obsoletos && (
                        <p className="text-rose-700">
                          De importaciones anteriores que ya no vienen en este archivo (se eliminarán): <strong>{importPreview.obsoletos.candidatos}</strong>
                        </p>
                      )}
                    </div>
                    {importReemplazarAnterior && importPreview.obsoletos && importPreview.obsoletos.candidatos > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg border-l-4 border-l-rose-500 bg-rose-50 px-4 py-3">
                        <span className="text-xs font-medium text-rose-800 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          {importPreview.obsoletos.candidatos} registro{importPreview.obsoletos.candidatos !== 1 ? "s" : ""} de importaciones anteriores se eliminará{importPreview.obsoletos.candidatos !== 1 ? "n" : ""} por no venir en este archivo:
                        </span>
                        <ul className="text-xs text-rose-700 list-disc list-inside max-h-32 overflow-y-auto">
                          {importPreview.obsoletos.ejemplos.map((o) => (
                            <li key={o.id}>[{o.secretaria ?? "—"}] folio={o.folioDictamen || o.folioJustificacion || "(sin folio)"}</li>
                          ))}
                        </ul>
                        {importPreview.obsoletos.candidatos > importPreview.obsoletos.ejemplos.length && (
                          <span className="text-xs text-rose-700/70">…y {importPreview.obsoletos.candidatos - importPreview.obsoletos.ejemplos.length} más.</span>
                        )}
                      </div>
                    )}
                    {importActualizarExistentes && importPreview.resumen.filasParaActualizar.length > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 px-4 py-3">
                        <span className="text-xs font-medium text-blue-800">
                          {importPreview.resumen.filasParaActualizar.length} fila{importPreview.resumen.filasParaActualizar.length !== 1 ? "s se actualizarán" : " se actualizará"}:
                        </span>
                        <ul className="text-xs text-blue-700 list-disc list-inside max-h-32 overflow-y-auto space-y-1">
                          {importPreview.resumen.filasParaActualizar.slice(0, 10).map((r, i) => (
                            <li key={i}>
                              Fila {r.idx} folio={r.folioDictamen || "(sin folio)"}: {r.cambios.map((c) => `${c.campo} ("${c.anterior}" → "${c.nuevo}")`).join(" | ")}
                            </li>
                          ))}
                        </ul>
                        {importPreview.resumen.filasParaActualizar.length > 10 && (
                          <span className="text-xs text-blue-700/70">…y {importPreview.resumen.filasParaActualizar.length - 10} más.</span>
                        )}
                      </div>
                    )}
                    {importPreview.resumen.filasConError.length > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg border-l-4 border-l-destructive bg-destructive/5 px-4 py-3">
                        <span className="text-xs font-medium text-destructive flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          {importPreview.resumen.filasConError.length} fila{importPreview.resumen.filasConError.length !== 1 ? "s" : ""} con error (no se importarán):
                        </span>
                        <ul className="text-xs text-destructive/90 list-disc list-inside max-h-32 overflow-y-auto">
                          {importPreview.resumen.filasConError.slice(0, 20).map((r, i) => (
                            <li key={i}>Fila {r.idx} [{r.secretariaRaw}] folio={r.folioDictamen || "(sin folio)"}: {r.errores.join(" | ")}</li>
                          ))}
                        </ul>
                        {importPreview.resumen.filasConError.length > 20 && (
                          <span className="text-xs text-destructive/70">…y {importPreview.resumen.filasConError.length - 20} más.</span>
                        )}
                      </div>
                    )}
                    {importPreview.resumen.filasConAdvertencia.length > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 px-4 py-3">
                        <span className="text-xs font-medium text-amber-800">
                          {importPreview.resumen.filasConAdvertencia.length} fila{importPreview.resumen.filasConAdvertencia.length !== 1 ? "s se importarán" : " se importará"} con advertencia (revisar manualmente):
                        </span>
                        <ul className="text-xs text-amber-700 list-disc list-inside max-h-24 overflow-y-auto">
                          {importPreview.resumen.filasConAdvertencia.slice(0, 10).map((r, i) => (
                            <li key={i}>Fila {r.idx} folio={r.folioDictamen || "(sin folio)"}: {r.advertencias.join(" | ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            {importResult ? (
              <Button
                variant="vino"
                className="rounded-full h-10 px-6 font-normal shadow-sm"
                onClick={() => { setImportOpen(false); resetImportDialog() }}
              >
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  variant="default"
                  className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
                  onClick={() => setImportOpen(false)}
                  disabled={importCommitLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="vino"
                  className="rounded-full h-10 px-6 font-normal shadow-sm"
                  onClick={handleImportCommit}
                  disabled={
                    importCommitLoading || importPreviewLoading || !importPreview ||
                    (importPreview.resumen.listasParaImportar === 0
                      && importPreview.resumen.listasParaActualizar === 0
                      && !(importReemplazarAnterior && (importPreview.obsoletos?.candidatos ?? 0) > 0))
                  }
                >
                  {importCommitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {importCommitLoading
                    ? "Importando…"
                    : `Confirmar importación${importPreview ? ` (${importPreview.resumen.listasParaImportar}${importPreview.resumen.listasParaActualizar > 0 ? ` + ${importPreview.resumen.listasParaActualizar} act.` : ""}${importReemplazarAnterior && importPreview.obsoletos ? ` − ${importPreview.obsoletos.candidatos} elim.` : ""})` : ""}`}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CatalogoJustificacionesPage() {
  const { user } = useAuth()
  const [canAdministrar, setCanAdministrar] = useState(user?.catalogoAdministracion === true)
  const [canConsultar, setCanConsultar] = useState(user?.catalogoConsulta === true)
  const [consultaCount, setConsultaCount] = useState<number | null>(null)
  const [adminCount, setAdminCount] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) { setCanAdministrar(false); setCanConsultar(false); return }
    fetch(`/api/catalogo-justificaciones/puede-administrar?userId=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setCanAdministrar(d.puede === true)
        setCanConsultar(d.puedeConsultar === true)
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!canAdministrar || !user?.id) return
    const params = new URLSearchParams({ page: "1", limit: "1", userId: user.id })
    fetch(`/api/catalogo-justificaciones/admin?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAdminCount(d.total) })
      .catch(() => {})
  }, [canAdministrar, user?.id])
  return (
    <PageLayout
      title="Catálogo para Dictaminaciones Técnicas Funcionales para la Prestación de Servicios Profesionales de la Administración Pública Centralizada del Poder Ejecutivo Estatal"
      description="Consulta las Cartas Descriptivas."
    >
      {canAdministrar || canConsultar ? (
        <Tabs
          key={`${canConsultar}-${canAdministrar}`}
          defaultValue={canConsultar ? "consulta" : "administracion"}
          className="w-full gap-3"
        >
          <TabsList>
            {canConsultar && (
              <TabsTrigger value="consulta" className="gap-1.5">
                <Search className="h-4 w-4" />
                Consulta
                {consultaCount !== null && <span className={TAB_BADGE}>{consultaCount}</span>}
              </TabsTrigger>
            )}
            {canAdministrar && (
              <TabsTrigger value="administracion" className="gap-1.5">
                <ListChecks className="h-4 w-4" />
                Administración
                {adminCount !== null && <span className={TAB_BADGE}>{adminCount}</span>}
              </TabsTrigger>
            )}
          </TabsList>
          {canConsultar && (
            <TabsContent value="consulta">
              <ConsultaTab onCountChange={setConsultaCount} />
            </TabsContent>
          )}
          {canAdministrar && (
            <TabsContent value="administracion">
              <AdministracionTab onCountChange={setAdminCount} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium text-card-foreground">Sin acceso al Catálogo</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            No tienes permiso de Consulta ni de Administración para esta sección. Solicita acceso a un administrador.
          </p>
        </div>
      )}
    </PageLayout>
  )
}