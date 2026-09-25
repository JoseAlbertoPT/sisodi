"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Check, X, AlertCircle } from "lucide-react"

interface NotaResponse {
  ok: boolean
  error?: string
  ejercicio: number
  valor: string
  existe: boolean
  ejercicios: number[]
  disponiblesNueva: number[]
}

async function fetchNota(anio: number): Promise<NotaResponse> {
  const res = await fetch(`/api/configuracion/nota-dictamen?ejercicio=${anio}`, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo cargar la nota")
  return json
}

/**
 * Nota del Dictamen / Justificación por año (Configuración > Nota), con la
 * misma mecánica que el Tabulador: selector de año, Editar, y "Nueva nota" —
 * solo para años que ya tienen Calendario, precargada con la del año anterior.
 * Los PDFs usan la nota del año en curso.
 */
export function NotaTabContent() {
  const { toast } = useToast()
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [aniosNota, setAniosNota] = useState<number[]>([])
  const [disponibles, setDisponibles] = useState<number[]>([])

  const [valor, setValor] = useState("")
  const [original, setOriginal] = useState("")
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // "Nueva nota": año que se está creando (aún sin guardar).
  const [anioNueva, setAnioNueva] = useState<number | null>(null)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [nuevaAnioSel, setNuevaAnioSel] = useState("")
  const [nuevaCargando, setNuevaCargando] = useState(false)

  const aplicarListas = (r: NotaResponse) => {
    setAniosNota(r.ejercicios ?? [])
    setDisponibles(r.disponiblesNueva ?? [])
  }

  useEffect(() => {
    let vigente = true
    setLoading(true)
    setError(null)
    fetchNota(anio)
      .then((r) => {
        if (!vigente) return
        setValor(r.valor)
        setOriginal(r.valor)
        aplicarListas(r)
      })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar la nota") })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [anio])

  const aniosSelector = [...new Set([...aniosNota, new Date().getFullYear(), anio])].sort((a, b) => a - b)
  const anioEditado = anioNueva ?? anio

  const iniciarEditar = () => { setError(null); setEditando(true) }
  const cancelar = () => {
    setValor(original)
    setAnioNueva(null)
    setError(null)
    setEditando(false)
  }

  const guardar = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/configuracion/nota-dictamen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ejercicio: anioEditado, valor }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al guardar la nota")
      toast({ title: "Nota guardada", description: `Nota ${anioEditado} guardada correctamente.` })
      setEditando(false)
      if (anioNueva !== null) {
        setAnioNueva(null)
        setAnio(anioNueva) // recarga la nota y las listas de años
      } else {
        setOriginal(valor)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la nota")
    } finally {
      setSaving(false)
    }
  }

  const abrirNueva = async () => {
    try { aplicarListas(await fetchNota(anio)) } catch { /* se usan las listas ya cargadas */ }
    setNuevaAnioSel("")
    setNuevaOpen(true)
  }

  // Precarga con la nota del año más reciente anterior al elegido (o la vigente si no hay).
  const confirmarNueva = async () => {
    const nuevo = Number(nuevaAnioSel)
    if (!disponibles.includes(nuevo)) return
    const previos = aniosNota.filter((y) => y < nuevo)
    const base = previos.length > 0 ? Math.max(...previos) : nuevo
    setNuevaCargando(true)
    try {
      const r = await fetchNota(base)
      setOriginal(valor)
      setValor(r.valor)
      setAnioNueva(nuevo)
      setError(null)
      setEditando(true)
      setNuevaOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "No se pudo cargar la nota anterior" })
    } finally {
      setNuevaCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))} disabled={editando}>
          <SelectTrigger className="w-[100px] h-9 py-2 text-xs font-mono"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            {aniosSelector.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {!editando ? (
          <>
            <Button variant="default" size="sm" className="text-xs h-9" onClick={iniciarEditar} disabled={loading}>
              Editar
            </Button>
            <Button size="sm" variant="vino" className="gap-1.5 text-xs h-9" onClick={() => void abrirNueva()} disabled={loading}>
              <Plus className="h-3.5 w-3.5" />Nueva nota
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="primary" className="gap-1.5 text-xs h-9" onClick={() => void guardar()} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Guardar
            </Button>
            <Button variant="default" size="sm" className="gap-1.5 text-xs h-9" onClick={cancelar} disabled={saving}>
              <X className="h-3 w-3" />Cancelar
            </Button>
          </>
        )}
      </div>

      {anioNueva !== null && (
        <div className="flex items-center gap-2 rounded-xl bg-[#ecf2ff] px-4 py-3 text-sm text-[#1e3a8a]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Nueva nota {anioNueva}: se cargó el texto del año anterior. Ajústelo y presione Guardar.
        </div>
      )}

      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando…
            </div>
          ) : (
            <textarea
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              readOnly={!editando}
              rows={10}
              className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed focus:outline-none ${
                editando
                  ? "border-[var(--sem-border-md)] bg-background focus:border-[#2D3B2D]"
                  : "border-border/60 bg-muted/30 text-muted-foreground cursor-default"
              }`}
            />
          )}
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />{error}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={nuevaOpen} onOpenChange={setNuevaOpen}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">Nueva nota</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Se creará la nota del año elegido, precargada con la del año anterior para solo ajustar lo que cambie.
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            {disponibles.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  No hay años disponibles. Solo se puede crear la nota de un año que ya tenga Calendario
                  (y que aún no tenga nota). Cree primero el Calendario en la pestaña Calendario.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Año</span>
                <Select value={nuevaAnioSel} onValueChange={setNuevaAnioSel}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {disponibles.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">Años con Calendario creado.</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setNuevaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm gap-1.5"
              onClick={() => void confirmarNueva()}
              disabled={nuevaCargando || disponibles.length === 0 || !nuevaAnioSel}
            >
              {nuevaCargando && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
