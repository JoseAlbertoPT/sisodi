"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { useRealtime } from "@/hooks/use-realtime"
import { fetchCentralizadaTree } from "@/lib/catalogo-api"
import { parseImporteTexto } from "@/lib/parse-importe"
import { Loader2, Plus, Trash2, AlertCircle, Rows3, ChevronDown, Info, Check, X, CopyPlus } from "lucide-react"

interface TabuladorRow {
  id: number
  nivel: string
  categoria: string
  importeBrutoMin: number
  importeBrutoMax: number
  secretarias: string[]
}

interface DraftRow {
  key: number
  nivel: string
  categoria: string
  importeBrutoMin: string
  importeBrutoMax: string
  secretarias: string[]
}

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 })

function nuevoDraft(key: number): DraftRow {
  return { key, nivel: "", categoria: "", importeBrutoMin: "", importeBrutoMax: "", secretarias: [] }
}

function secretariasLabel(secretarias: string[]): string {
  if (secretarias.length === 0) return "Todas"
  if (secretarias.length === 1) return secretarias[0]
  return "Múltiples"
}

/** Input de importe: mientras se escribe muestra el número plano; al salir del
 * campo lo formatea como moneda ($ 1,300.00). `value`/`onChange` siguen
 * trabajando con el string numérico crudo (lo que se manda a la API). */
function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  // Mientras se escribe se conserva el texto tal cual (puede traer coma
  // decimal: "348,00", "1.300,50"); hacia fuera siempre va el número normalizado.
  const [draft, setDraft] = useState<string | null>(null)
  const n = Number(value)
  const display = draft !== null
    ? draft
    : value === "" || !Number.isFinite(n)
      ? value
      : `$ ${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      className={className}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, "")
        setDraft(raw)
        onChange(String(parseImporteTexto(raw) ?? ""))
      }}
    />
  )
}

/** Alterna entre "Todas" (arreglo vacío) y "Específicas" (elegidas de `catalogo` vía un popover con checkboxes). */
function SecretariaScopeField({
  value,
  onChange,
  catalogo,
}: {
  value: string[]
  onChange: (v: string[]) => void
  catalogo: string[]
}) {
  const [open, setOpen] = useState(false)
  // "especificas" también se activa con el popover abierto (aunque todavía
  // no haya nada marcado) — así al hacer clic en "Específicas" la lista
  // aparece de inmediato en vez de requerir marcar algo primero. Si se cierra
  // sin marcar nada, vuelve a "Todas" solo (value sigue siendo []).
  const modo: "todas" | "especificas" = value.length > 0 || open ? "especificas" : "todas"

  return (
    <div className="flex items-center gap-1.5">
      <div className="inline-flex rounded-lg border border-input p-0.5 text-xs shrink-0">
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${modo === "todas" ? "bg-accent-primary text-accent-on-primary" : "text-muted-foreground hover:text-card-foreground"}`}
          onClick={() => { onChange([]); setOpen(false) }}
        >
          Todas
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${modo === "especificas" ? "bg-accent-primary text-accent-on-primary" : "text-muted-foreground hover:text-card-foreground"}`}
          onClick={() => setOpen(true)}
        >
          Específicas
        </button>
      </div>
      {modo === "especificas" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-lg border border-input bg-bg-base text-xs text-content-high hover:bg-bg-surface-md transition-colors min-w-0"
            >
              <span className="truncate max-w-[10rem]">
                {value.length > 0 ? `${value.length} Secretaría${value.length !== 1 ? "s" : ""}` : "Elegir Secretarías"}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-2 max-h-80 overflow-y-auto overscroll-contain rounded-xl bg-bg-base"
            align="start"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {catalogo.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No se pudo cargar el catálogo de Secretarías.</p>
            ) : (
              <div className="flex flex-col">
                {catalogo.map((nombre) => {
                  const elegida = value.includes(nombre)
                  return (
                    <button
                      key={nombre}
                      type="button"
                      onClick={() => onChange(elegida ? value.filter((s) => s !== nombre) : [...value, nombre])}
                      className="flex items-center gap-2.5 text-left px-3 py-2 text-sm font-light text-content-high rounded-md transition-colors hover:bg-bg-surface-md"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors ${
                          elegida ? "bg-[var(--color-core-mora-30)] border-[var(--color-core-mora-30)] text-white" : "border-[#ccc] bg-white"
                        }`}
                      >
                        {elegida && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span>{nombre}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

const MAX_NIVELES_PLANTILLA = 100

export function TabuladorTabContent() {
  const { toast } = useToast()
  // Tabulador por año. El selector muestra los años con tabulador; un año nuevo
  // solo se crea con "Crear nueva plantilla" y solo si ya tiene Calendario.
  const [ejercicio, setEjercicio] = useState(() => new Date().getFullYear())
  const [aniosTabulador, setAniosTabulador] = useState<number[]>([])
  const [aniosPlantilla, setAniosPlantilla] = useState<number[]>([])
  const [plantillaOpen, setPlantillaOpen] = useState(false)
  const [plantillaAnio, setPlantillaAnio] = useState("")
  const [plantillaNiveles, setPlantillaNiveles] = useState("")
  const [rows, setRows] = useState<TabuladorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogoSecretarias, setCatalogoSecretarias] = useState<string[]>([])

  // Alta: tabla de filas nuevas, se pueden agregar varias antes de guardar.
  const draftKeyRef = useRef(0)
  const [agregando, setAgregando] = useState(false)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  // Año al que se guardan las filas del diálogo (el seleccionado, o el de la plantilla).
  const [anioDrafts, setAnioDrafts] = useState(() => new Date().getFullYear())
  const [esPlantilla, setEsPlantilla] = useState(false)
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [draftsSaving, setDraftsSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TabuladorRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  // Edición en tabla (como "Editar fechas" del Calendario): todas las filas se
  // vuelven editables a la vez y se guardan juntas. `key` = id del registro.
  const [editandoTabla, setEditandoTabla] = useState(false)
  const [tablaDrafts, setTablaDrafts] = useState<DraftRow[]>([])
  const [tablaError, setTablaError] = useState<string | null>(null)
  const [tablaSaving, setTablaSaving] = useState(false)

  const cargar = (anio: number = ejercicio) => {
    setError(null)
    fetch(`/api/tabulador?ejercicio=${anio}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) { setError(json?.error ?? "Error al cargar el tabulador"); return }
        // Respuesta de otro año (se cambió el selector mientras cargaba): se ignora.
        if (json.ejercicio !== undefined && json.ejercicio !== anio) return
        setRows(json.tabulador ?? [])
      })
      .catch(() => setError("Error al cargar el tabulador"))
      .finally(() => { setLoading(false); setLoadedOnce(true) })
  }

  const cargarAnios = () =>
    fetch("/api/tabulador/ejercicios", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return
        setAniosTabulador(json.ejercicios ?? [])
        setAniosPlantilla(json.disponiblesPlantilla ?? [])
      })
      .catch(() => {})

  // Al cambiar de año sí se muestra el spinner; los refrescos en tiempo real no.
  useEffect(() => {
    setLoading(true)
    setRows([])
    cargar(ejercicio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio])
  useEffect(() => { void cargarAnios() }, [])
  // Refresco silencioso: no vuelve a mostrar el spinner ni oculta la tabla
  // (mismo criterio que lib/calendario-store.tsx para evitar parpadeo).
  useRealtime(["tabulador", "calendario"], () => { if (loadedOnce) { cargar(); void cargarAnios() } })
  const aniosSelector = [...new Set([...aniosTabulador, new Date().getFullYear(), ejercicio])].sort((a, b) => a - b)

  useEffect(() => {
    fetchCentralizadaTree()
      .then((tree) => setCatalogoSecretarias(tree.map((n) => n.nombre)))
      .catch(() => {})
  }, [])

  const nuevaKey = () => { draftKeyRef.current += 1; return draftKeyRef.current }

  const iniciarAgregar = () => {
    setDrafts([nuevoDraft(nuevaKey())])
    setAnioDrafts(ejercicio)
    setEsPlantilla(false)
    setDraftsError(null)
    setAgregando(true)
  }
  const abrirPlantilla = async () => {
    await cargarAnios()
    setPlantillaAnio("")
    setPlantillaNiveles("")
    setPlantillaOpen(true)
  }
  // Año más reciente anterior al elegido que ya tiene tabulador: de ahí se precargan los niveles.
  const anioBasePlantilla = (anio: number): number | null => {
    const previos = aniosTabulador.filter((y) => y < anio)
    return previos.length > 0 ? Math.max(...previos) : null
  }
  const [plantillaCargando, setPlantillaCargando] = useState(false)
  const confirmarPlantilla = async () => {
    const anio = Number(plantillaAnio)
    if (!aniosPlantilla.includes(anio)) {
      toast({ variant: "destructive", title: "Seleccione el año", description: "Elija un año que ya tenga Calendario." })
      return
    }
    const anioBase = anioBasePlantilla(anio)
    let nuevas: DraftRow[]
    if (anioBase !== null) {
      // Precarga con el tabulador anterior para solo ajustar lo que cambie.
      setPlantillaCargando(true)
      try {
        const res = await fetch(`/api/tabulador?ejercicio=${anioBase}`, { cache: "no-store" })
        const json = await res.json()
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo cargar el tabulador anterior")
        const previos: TabuladorRow[] = json.tabulador ?? []
        nuevas = previos.map((r) => ({
          key: nuevaKey(),
          nivel: r.nivel,
          categoria: r.categoria,
          importeBrutoMin: String(r.importeBrutoMin),
          importeBrutoMax: String(r.importeBrutoMax),
          secretarias: r.secretarias,
        }))
      } catch (e) {
        toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "No se pudo cargar el tabulador anterior" })
        return
      } finally {
        setPlantillaCargando(false)
      }
      if (nuevas.length === 0) nuevas = [nuevoDraft(nuevaKey())]
    } else {
      const n = parseInt(plantillaNiveles, 10)
      if (!n || n < 1 || n > MAX_NIVELES_PLANTILLA) {
        toast({ variant: "destructive", title: "Cantidad inválida", description: `Indique cuántos niveles tendrá el tabulador (1 a ${MAX_NIVELES_PLANTILLA}).` })
        return
      }
      nuevas = Array.from({ length: n }, () => nuevoDraft(nuevaKey()))
    }
    setPlantillaOpen(false)
    setDrafts(nuevas)
    setAnioDrafts(anio)
    setEsPlantilla(true)
    setDraftsError(null)
    setAgregando(true)
  }
  const cancelarAgregar = () => {
    setAgregando(false)
    setDrafts([])
    setDraftsError(null)
  }
  const agregarFila = () => setDrafts((prev) => [...prev, nuevoDraft(nuevaKey())])
  const quitarFila = (key: number) => setDrafts((prev) => prev.length <= 1 ? prev : prev.filter((d) => d.key !== key))
  const updateDraft = (key: number, field: keyof Omit<DraftRow, "key" | "secretarias">, value: string) => {
    setDrafts((prev) => prev.map((d) => d.key === key ? { ...d, [field]: value } : d))
  }

  const guardarDrafts = async () => {
    const tocadas = drafts.filter((d) => d.nivel.trim() || d.categoria.trim() || d.importeBrutoMin.trim() || d.importeBrutoMax.trim() || d.secretarias.length > 0)
    if (tocadas.length === 0) { setDraftsError("Agregue al menos un registro"); return }

    const payloads: { nivel: string; categoria: string; importeBrutoMin: number; importeBrutoMax: number; secretarias: string[] }[] = []
    for (let i = 0; i < tocadas.length; i++) {
      const d = tocadas[i]
      const nivel = d.nivel.trim()
      const categoria = d.categoria.trim()
      const importeBrutoMin = Number(d.importeBrutoMin)
      const importeBrutoMax = Number(d.importeBrutoMax)
      const etiqueta = `Fila ${i + 1}`
      if (!nivel || !categoria) { setDraftsError(`${etiqueta}: nivel y categoría son requeridos`); return }
      if (!Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
        setDraftsError(`${etiqueta}: importe bruto mínimo y máximo deben ser numéricos`); return
      }
      if (importeBrutoMin > importeBrutoMax) { setDraftsError(`${etiqueta}: el importe mínimo no puede ser mayor al máximo`); return }
      payloads.push({ nivel, categoria, importeBrutoMin, importeBrutoMax, secretarias: d.secretarias })
    }
    const vistos = new Set<string>()
    for (const p of payloads) {
      const k = `${p.nivel}__${p.categoria}__${[...p.secretarias].sort().join(",")}`
      if (vistos.has(k)) { setDraftsError(`Nivel ${p.nivel} / categoría ${p.categoria} está repetido entre las filas nuevas (mismo alcance de Secretaría)`); return }
      vistos.add(k)
    }

    setDraftsSaving(true)
    setDraftsError(null)
    try {
      for (let i = 0; i < payloads.length; i++) {
        const res = await fetch("/api/tabulador", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloads[i], ejercicio: anioDrafts }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(`Fila ${i + 1}: ${json.error || "Error al guardar el registro"}`)
      }
      toast({ title: payloads.length > 1 ? `${payloads.length} registros creados` : "Registro creado" })
      setAgregando(false)
      setDrafts([])
      void cargarAnios()
      // Plantilla de otro año: se muestra ese año ya creado.
      if (anioDrafts !== ejercicio) setEjercicio(anioDrafts)
      else cargar()
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : "Error al guardar los registros")
    } finally {
      setDraftsSaving(false)
    }
  }

  const iniciarEdicionTabla = () => {
    setTablaDrafts(rows.map((r) => ({
      key: r.id,
      nivel: r.nivel,
      categoria: r.categoria,
      importeBrutoMin: String(r.importeBrutoMin),
      importeBrutoMax: String(r.importeBrutoMax),
      secretarias: r.secretarias,
    })))
    setTablaError(null)
    setEditandoTabla(true)
  }
  const cancelarEdicionTabla = () => {
    setEditandoTabla(false)
    setTablaDrafts([])
    setTablaError(null)
  }
  const updateTablaDraft = (key: number, cambios: Partial<Omit<DraftRow, "key">>) =>
    setTablaDrafts((prev) => prev.map((d) => d.key === key ? { ...d, ...cambios } : d))

  const guardarTabla = async () => {
    const payloads: { id: number; nivel: string; categoria: string; importeBrutoMin: number; importeBrutoMax: number; secretarias: string[] }[] = []
    for (let i = 0; i < tablaDrafts.length; i++) {
      const d = tablaDrafts[i]
      const nivel = d.nivel.trim()
      const categoria = d.categoria.trim()
      const importeBrutoMin = Number(d.importeBrutoMin)
      const importeBrutoMax = Number(d.importeBrutoMax)
      const etiqueta = `Fila ${i + 1}`
      if (!nivel || !categoria) { setTablaError(`${etiqueta}: nivel y categoría son requeridos`); return }
      if (d.importeBrutoMin.trim() === "" || d.importeBrutoMax.trim() === "" || !Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
        setTablaError(`${etiqueta}: importe bruto mínimo y máximo deben ser numéricos`); return
      }
      if (importeBrutoMin > importeBrutoMax) { setTablaError(`${etiqueta}: el importe mínimo no puede ser mayor al máximo`); return }
      payloads.push({ id: d.key, nivel, categoria, importeBrutoMin, importeBrutoMax, secretarias: d.secretarias })
    }
    const vistos = new Set<string>()
    for (const p of payloads) {
      const k = `${p.nivel}__${p.categoria}__${[...p.secretarias].sort().join(",")}`
      if (vistos.has(k)) { setTablaError(`Nivel ${p.nivel} / categoría ${p.categoria} está repetido (mismo alcance de Secretaría)`); return }
      vistos.add(k)
    }

    // Solo se envían las filas que cambiaron.
    const original = new Map(rows.map((r) => [r.id, r]))
    const cambiadas = payloads.filter((p) => {
      const o = original.get(p.id)
      return !o || o.nivel !== p.nivel || o.categoria !== p.categoria
        || o.importeBrutoMin !== p.importeBrutoMin || o.importeBrutoMax !== p.importeBrutoMax
        || [...o.secretarias].sort().join(",") !== [...p.secretarias].sort().join(",")
    })
    if (cambiadas.length === 0) { cancelarEdicionTabla(); return }

    setTablaSaving(true)
    setTablaError(null)
    try {
      for (const { id, ...datos } of cambiadas) {
        const res = await fetch(`/api/tabulador/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(`Nivel ${datos.nivel} / ${datos.categoria}: ${json.error || "Error al guardar el registro"}`)
      }
      toast({ title: cambiadas.length > 1 ? `${cambiadas.length} registros actualizados` : "Registro actualizado" })
      setEditandoTabla(false)
      setTablaDrafts([])
      cargar()
    } catch (e) {
      // Las filas guardadas antes del error ya quedaron; se recarga para reflejarlas.
      setTablaError(e instanceof Error ? e.message : "Error al guardar los registros")
      cargar()
    } finally {
      setTablaSaving(false)
    }
  }

  const eliminar = async () => {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      const res = await fetch(`/api/tabulador/${deleteTarget.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al eliminar el registro")
      toast({ title: "Registro eliminado" })
      // Se elimina desde el modo edición: la fila sale también de lo que se está editando.
      const eliminadoId = deleteTarget.id
      setTablaDrafts((prev) => prev.filter((d) => d.key !== eliminadoId))
      setDeleteTarget(null)
      cargar()
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar", description: e instanceof Error ? e.message : undefined })
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-end gap-2">
          <Select value={String(ejercicio)} onValueChange={(v) => setEjercicio(Number(v))} disabled={editandoTabla}>
            <SelectTrigger className="w-[100px] h-9 py-2 text-xs font-mono"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {aniosSelector.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {!editandoTabla ? (
            <>
              {rows.length > 0 && (
                <Button variant="default" size="sm" className="text-xs h-9" onClick={iniciarEdicionTabla} disabled={loading}>
                  Editar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="vino" className="gap-1.5 text-xs h-9">
                    <Plus className="h-3.5 w-3.5" />Agregar Nivel<ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={iniciarAgregar}>
                    <Plus className="h-4 w-4" /> Agregar nivel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void abrirPlantilla()}>
                    <CopyPlus className="h-4 w-4" /> Nuevo tabulador
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button size="sm" variant="primary" className="gap-1.5 text-xs h-9" onClick={guardarTabla} disabled={tablaSaving}>
                {tablaSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Guardar
              </Button>
              <Button variant="default" size="sm" className="gap-1.5 text-xs h-9" onClick={cancelarEdicionTabla} disabled={tablaSaving}>
                <X className="h-3 w-3" />Cancelar
              </Button>
            </>
          )}
        </div>

        {tablaError && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />{tablaError}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            <span className="text-sm text-muted-foreground">Cargando tabulador...</span>
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-5 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10">
                <Rows3 className="h-7 w-7 text-secondary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold text-card-foreground">Sin registros en el tabulador {ejercicio}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Agregue el primer nivel para que esté disponible en "Equivalencia al Tabulador" dentro de Nueva Solicitud.
                </p>
              </div>
              <Button variant="vino" className="gap-2" onClick={iniciarAgregar}>
                <Plus className="h-4 w-4" />Agregar Nivel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
            <table className="w-full min-w-[760px] text-sm table-fixed">
              <thead>
                <tr className="bg-bg-base text-content-high">
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[12%]">Nivel</th>
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[16%]">Categoría</th>
                  <th className="px-5 py-3 text-center font-semibold align-middle w-[15%]">Rango percepción<br />mensuales mínimo</th>
                  <th className="px-5 py-3 text-center font-semibold align-middle w-[15%]">Rango percepción<br />mensuales máxima</th>
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[27%]">Secretaría /Dependencia</th>
                  {/* Acciones (eliminar) solo en modo edición. */}
                  {editandoTabla && <th className="px-5 py-3 text-right font-semibold align-middle w-[15%]">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {editandoTabla && tablaDrafts.map((d, idx) => (
                  <tr key={d.key} className={`border-t border-border/60 ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                    <td className="px-2 py-1.5 align-middle">
                      <Input value={d.nivel} onChange={(e) => updateTablaDraft(d.key, { nivel: e.target.value })} placeholder="Ej. 106" className="h-8 text-sm" disabled={tablaSaving} />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <Input value={d.categoria} onChange={(e) => updateTablaDraft(d.key, { categoria: e.target.value })} placeholder="Ej. A a C" className="h-8 text-sm" disabled={tablaSaving} />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <MoneyInput value={d.importeBrutoMin} onChange={(v) => updateTablaDraft(d.key, { importeBrutoMin: v })} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <MoneyInput value={d.importeBrutoMax} onChange={(v) => updateTablaDraft(d.key, { importeBrutoMax: v })} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <SecretariaScopeField
                        value={d.secretarias}
                        onChange={(v) => updateTablaDraft(d.key, { secretarias: v })}
                        catalogo={catalogoSecretarias}
                      />
                    </td>
                    <td className="px-5 py-1.5 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { const r = rows.find((x) => x.id === d.key); if (r) setDeleteTarget(r) }}
                          disabled={tablaSaving}
                          aria-label="Eliminar registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!editandoTabla && rows.map((row, idx) => (
                  <tr key={row.id} className={`border-t border-border/60 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-muted/40`}>
                    <td className="px-5 py-3 align-middle"><span className="font-semibold text-card-foreground">{row.nivel}</span></td>
                    <td className="px-5 py-3 align-middle text-card-foreground">{row.categoria}</td>
                    <td className="px-5 py-3 text-center align-middle tabular-nums">{fmt(row.importeBrutoMin)}</td>
                    <td className="px-5 py-3 text-center align-middle tabular-nums">{fmt(row.importeBrutoMax)}</td>
                    <td className="px-5 py-3 align-middle text-card-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{secretariasLabel(row.secretarias)}</span>
                        {row.secretarias.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Ver Secretarías seleccionadas"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-content-high transition-colors shrink-0"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px]">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {row.secretarias.map((s) => <li key={s}>{s}</li>)}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={agregando} onOpenChange={(v) => { if (!v) cancelarAgregar() }}>
        {/* Alto máximo con scroll solo en las filas: título y botones siempre visibles. */}
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
          <div className="shrink-0 px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              {esPlantilla ? `Tabulador ${anioDrafts}` : `Agregar Nivel — ${anioDrafts}`}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {esPlantilla
                ? `Llene los niveles del tabulador ${anioDrafts}. Puede agregar o quitar filas.`
                : "Puede agregar uno o varios niveles a la vez."}
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5 min-h-0 flex-1 overflow-y-auto">
            <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low shrink-0">
              <table className="w-full min-w-[680px] text-sm table-fixed">
                <thead>
                  <tr className="bg-bg-base text-content-high">
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[13%]">Nivel</th>
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[17%]">Categoría</th>
                    <th className="px-3 py-2 text-center font-semibold align-middle w-[15%]">Rango percepción<br />mensuales mínimo</th>
                    <th className="px-3 py-2 text-center font-semibold align-middle w-[15%]">Rango percepción<br />mensuales máxima</th>
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[30%]">Secretaría /Dependencia</th>
                    <th className="px-3 py-2 align-middle w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, idx) => (
                    <tr key={d.key} className={`border-t border-border/60 ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                      <td className="px-2 py-1.5 align-middle">
                        <Input value={d.nivel} onChange={(e) => updateDraft(d.key, "nivel", e.target.value)} placeholder="Ej. 106" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <Input value={d.categoria} onChange={(e) => updateDraft(d.key, "categoria", e.target.value)} placeholder="Ej. A a C" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <MoneyInput value={d.importeBrutoMin} onChange={(v) => updateDraft(d.key, "importeBrutoMin", v)} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <MoneyInput value={d.importeBrutoMax} onChange={(v) => updateDraft(d.key, "importeBrutoMax", v)} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <SecretariaScopeField
                          value={d.secretarias}
                          onChange={(v) => setDrafts((prev) => prev.map((x) => x.key === d.key ? { ...x, secretarias: v } : x))}
                          catalogo={catalogoSecretarias}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => quitarFila(d.key)} disabled={drafts.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 self-start text-secondary" onClick={agregarFila}>
              <Plus className="h-3.5 w-3.5" />Agregar otra fila
            </Button>
          </div>
          {/* El error va fuera del área con scroll para que se vea aunque haya muchas filas. */}
          {draftsError && (
            <p className="shrink-0 text-xs text-destructive flex items-center gap-1 px-6 pb-3">
              <AlertCircle className="h-3.5 w-3.5" />{draftsError}
            </p>
          )}
          <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={cancelarAgregar}
              disabled={draftsSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm gap-1.5"
              onClick={guardarDrafts}
              disabled={draftsSaving}
            >
              {draftsSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {draftsSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={plantillaOpen} onOpenChange={setPlantillaOpen}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">Nuevo tabulador</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Se creará el tabulador del año elegido.
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            {aniosPlantilla.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  No hay años disponibles. Solo se puede crear el tabulador de un año que ya tenga Calendario
                  (y que aún no tenga tabulador). Cree primero el Calendario en Configuración &gt; Calendario.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Año</span>
                  <Select value={plantillaAnio} onValueChange={setPlantillaAnio}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      {aniosPlantilla.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-muted-foreground">Años con Calendario creado.</span>
                </div>
                {!plantillaAnio ? null : anioBasePlantilla(Number(plantillaAnio)) !== null ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se precargan los niveles del tabulador <strong>{anioBasePlantilla(Number(plantillaAnio))}</strong>.
                    Podrá editarlos, agregar o quitar filas antes de guardar.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Número de niveles</span>
                    <Input
                      type="number" min={1} max={MAX_NIVELES_PLANTILLA}
                      value={plantillaNiveles}
                      onChange={(e) => setPlantillaNiveles(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void confirmarPlantilla() }}
                      placeholder="Ej. 13"
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setPlantillaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm"
              onClick={() => void confirmarPlantilla()}
              disabled={
                plantillaCargando || aniosPlantilla.length === 0 || !plantillaAnio
                || (anioBasePlantilla(Number(plantillaAnio)) === null && !plantillaNiveles)
              }
            >
              {plantillaCargando && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear tabulador
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        variant="eliminar"
        title="Eliminar registro"
        description={<>Se eliminará el nivel <strong>{deleteTarget?.nivel}</strong> — <strong>{deleteTarget?.categoria}</strong> del tabulador. Esta acción no se puede deshacer.</>}
        confirmLabel="Sí, eliminar"
        loading={deleteSaving}
      />
    </>
  )
}
