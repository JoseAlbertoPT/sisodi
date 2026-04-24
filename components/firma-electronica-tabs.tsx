"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  CheckCircle2, Loader2, Copy, Link as LinkIcon, Shield,
  RefreshCw, AlertCircle, Users, Lock, Play, Briefcase, FileKey, KeyRound, AlertTriangle, X,
} from "lucide-react"

interface Firmante {
  id: number
  orden: number
  rol: string
  cargo: string
  tipo: "externo" | "interno"
  bandeja: string | null
  firmado: boolean
  fecha_firma: string | null
  nombre: string | null
  rfc: string | null
  correo: string | null
  cargo_firmante: string | null
  usuario_id: string | null
  acceso_token: string | null
}

interface FirmaProceso {
  id: number
  solicitud_id: number
  tipo: string
  uuid: string | null
  total_firmantes: number | null
  firmados: number
  estado: string
  fecha_completado: string | null
  externos_completos: boolean
  externos_total: number
  externos_firmados: number
}

interface Props {
  solicitudId: number
  folioJustificacion: string
  currentUserId: string
  onGenerarPdfBase64: () => Promise<string>
  onFinalizar: () => Promise<void> | void
  guardandoFinal: boolean
}

type TabKey = "firmantes" | "progreso"

export function FirmaElectronicaTabs({
  solicitudId,
  folioJustificacion,
  currentUserId,
  onGenerarPdfBase64,
  onFinalizar,
  guardandoFinal,
}: Props) {
  const [tab, setTab] = useState<TabKey>("firmantes")
  const [firma, setFirma] = useState<FirmaProceso | null>(null)
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const [iniciando, setIniciando] = useState(false)
  const [copiadoId, setCopiadoId] = useState<number | null>(null)
  const [regenerando, setRegenerando] = useState<number | null>(null)
  const [firmandoInline, setFirmandoInline] = useState<number | null>(null)

  const [cargoFirma, setCargoFirma] = useState("")
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [fraseKey, setFraseKey] = useState("")
  const [firmandoTrabajo, setFirmandoTrabajo] = useState(false)
  const [firmandoError, setFirmandoError] = useState<string | null>(null)
  const [avisoCargoAbierto, setAvisoCargoAbierto] = useState(false)
  const [cargoHabilitado, setCargoHabilitado] = useState(false)
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  const resetFirmandoInline = () => {
    setFirmandoInline(null)
    setCargoFirma(""); setCerFile(null); setKeyFile(null); setFraseKey("")
    setFirmandoError(null); setCargoHabilitado(false); setAvisoCargoAbierto(false)
  }

  const aceptarAvisoCargo = () => {
    setAvisoCargoAbierto(false); setCargoHabilitado(true)
    setTimeout(() => cargoInputRef.current?.focus(), 50)
  }

  const fileToBase64 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  const handleFirmarInline = async (firmanteId: number) => {
    if (!cargoFirma.trim() || !cerFile || !keyFile || !fraseKey) {
      setFirmandoError("Completa cargo, .cer, .key y contraseña"); return
    }
    setFirmandoTrabajo(true); setFirmandoError(null)
    try {
      const [cerB64, keyB64] = await Promise.all([fileToBase64(cerFile), fileToBase64(keyFile)])
      const res = await fetch("/api/firma-efirma/firmar-interno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmanteId, usuarioId: currentUserId,
          cargoFirmante: cargoFirma.trim(),
          certificado: cerB64, clavePrivada: keyB64, fraseClavePrivada: fraseKey,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setFirmandoError(json.error ?? "Error al firmar"); return }
      resetFirmandoInline()
      await cargar()
    } catch (e: any) {
      setFirmandoError(e?.message ?? "Error de conexión")
    } finally {
      setFirmandoTrabajo(false)
    }
  }

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/firma-efirma/estado?solicitudId=${solicitudId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setFirma(json.firma)
      setFirmantes(json.firmantes ?? [])
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [solicitudId])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (tab !== "progreso" || !firma) return
    pollRef.current = setInterval(cargar, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [tab, firma, cargar])

  const handleIniciar = async () => {
    setIniciando(true); setError(null)
    try {
      const pdfB64 = await onGenerarPdfBase64()
      const res = await fetch("/api/firma-efirma/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId,
          archivo: pdfB64,
          nombre: folioJustificacion,
          creadoPorId: currentUserId,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al iniciar"); return }
      await cargar()
    } catch (e: any) {
      setError(e?.message ?? "Error al iniciar")
    } finally {
      setIniciando(false)
    }
  }

  const copiarLink = async (f: Firmante) => {
    if (!firma?.uuid || !f.acceso_token) return
    const origen = typeof window !== "undefined" ? window.location.origin : ""
    const link = `${origen}/firmado/${firma.uuid}?t=${f.acceso_token}`
    await navigator.clipboard.writeText(link)
    setCopiadoId(f.id); setTimeout(() => setCopiadoId(null), 1500)
  }

  const regenerarLink = async (firmanteId: number) => {
    setRegenerando(firmanteId); setError(null)
    try {
      const res = await fetch("/api/firma-efirma/regenerar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmanteId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "No se pudo regenerar"); return }
      await cargar()
    } catch {
      setError("Error de conexión")
    } finally {
      setRegenerando(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando proceso de firma...
      </div>
    )
  }

  // Si no hay proceso aún, mostrar botón de iniciar.
  if (!firma) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Iniciar proceso de firma
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Se creará el proceso con todos los firmantes requeridos según el tipo de justificación.
              Los firmantes internos (UEFA, Revisor, Validador, Emisor) se identifican automáticamente a partir del historial de aprobaciones.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={handleIniciar} disabled={iniciando}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 self-end">
              {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar proceso
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const externos = firmantes.filter(f => f.tipo === "externo")
  const internosTodos = firmantes.filter(f => f.tipo === "interno")
  // Scope: si el user actual es un interno, sólo se muestra su fila (y las de externos).
  const miInterno = internosTodos.find(f => f.usuario_id === currentUserId) ?? null
  const internos = miInterno ? [miInterno] : internosTodos

  // Turno actual: el firmante con menor orden que aún no firma.
  const siguienteFirmante = firmantes
    .filter(f => !f.firmado)
    .sort((a, b) => a.orden - b.orden)[0] ?? null
  const siguienteOrden = siguienteFirmante?.orden ?? Infinity

  // Gate de "Enviar":
  //   - Si soy UEFA: cuando mi firma + todas las anteriores están listas (estricto).
  //   - Si soy otro interno: cuando mi firma está lista.
  //   - Si no soy ninguno identificado (admin): cuando TODO esté firmado.
  const puedeContinuar = (() => {
    if (miInterno) {
      return miInterno.firmado
    }
    return firma.estado === "completado" || (firma.total_firmantes !== null && firma.firmados >= firma.total_firmantes)
  })()

  const totalFirmantes = firma.total_firmantes ?? 0
  const pctFirmados = totalFirmantes > 0 ? Math.round((firma.firmados / totalFirmantes) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 rounded-md bg-muted p-1 self-start">
        {(["firmantes", "progreso"] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded ${tab === t ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}>
            {t === "firmantes" ? "Firmantes / Links" : "Progreso"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{firma.estado}</Badge>
          <span className="font-semibold">{firma.firmados} / {totalFirmantes} firmas</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Externos: {firma.externos_firmados}/{firma.externos_total}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${firma.estado === "completado" ? "bg-secondary" : "bg-primary"}`}
            style={{ width: `${pctFirmados}%` }}
          />
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-secondary" /> Externos
            <span className="text-xs text-muted-foreground ml-1">(firman primero)</span>
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={cargar} title="Actualizar"><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {externos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Esta justificación no requiere firmas externas.</p>
          ) : externos.map(f => (
            <FirmanteRow
              key={f.id}
              firmante={f}
              modo="externo"
              uuid={firma.uuid}
              copiadoId={copiadoId}
              regenerando={regenerando}
              esSuTurno={f.orden === siguienteOrden}
              onCopiar={() => copiarLink(f)}
              onRegenerar={() => regenerarLink(f.id)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" /> {miInterno ? "Mi firma" : "Internos"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {internos.map(f => (
            <div key={f.id} className="flex flex-col gap-2">
              <FirmanteRow
                firmante={f}
                modo="interno"
                esSuTurno={f.orden === siguienteOrden}
                esCurrent={f.usuario_id === currentUserId}
                onFirmar={() => setFirmandoInline(f.id)}
              />
              {firmandoInline === f.id && (
                <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Firmar como {f.rol}
                    </h4>
                    <Button size="icon" variant="ghost" onClick={resetFirmandoInline} className="h-7 w-7">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.cargo}</p>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
                    <Input
                      ref={cargoInputRef}
                      value={cargoFirma}
                      readOnly={!cargoHabilitado}
                      onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                      onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                      onChange={e => setCargoFirma(e.target.value.toUpperCase())}
                      placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                      className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""}`}
                      autoComplete="off"
                      name="cargo-firmante-uefa"
                    />
                    <p className="text-[10px] text-accent-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Escriba su cargo correctamente. Aparecerá impreso junto a su firma.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs flex items-center gap-1"><FileKey className="h-3.5 w-3.5" /> Certificado (.cer)</Label>
                      <Input type="file" accept=".cer" onChange={e => setCerFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Clave privada (.key)</Label>
                      <Input type="file" accept=".key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Contraseña de la clave privada</Label>
                    <Input type="password" value={fraseKey} onChange={e => setFraseKey(e.target.value)} />
                  </div>
                  {firmandoError && <p className="text-xs text-destructive">{firmandoError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetFirmandoInline} disabled={firmandoTrabajo}>Cancelar</Button>
                    <Button onClick={() => handleFirmarInline(f.id)} disabled={firmandoTrabajo}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                      {firmandoTrabajo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Firmar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end pt-2">
        <Button onClick={() => onFinalizar()} disabled={!puedeContinuar || guardandoFinal}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          {guardandoFinal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Enviar
        </Button>
      </div>

      <AlertDialog open={avisoCargoAbierto} onOpenChange={setAvisoCargoAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent-foreground" />
              Antes de escribir su cargo
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Escriba su cargo con <strong>exactitud y sin abreviaturas</strong>.
              Este texto aparecerá impreso junto a su firma en el PDF definitivo y
              <strong> no podrá modificarse después</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={aceptarAvisoCargo}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FirmanteRow({
  firmante, modo, uuid, copiadoId, regenerando, onCopiar, onRegenerar,
  esSuTurno, esCurrent, onFirmar,
}: {
  firmante: Firmante
  modo: "externo" | "interno"
  uuid?: string | null
  copiadoId?: number | null
  regenerando?: number | null
  onCopiar?: () => void
  onRegenerar?: () => void
  esSuTurno?: boolean
  esCurrent?: boolean
  onFirmar?: () => void
}) {
  const link = uuid && firmante.acceso_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/firmado/${uuid}?t=${firmante.acceso_token}`
    : ""
  const esperandoTurno = !firmante.firmado && !esSuTurno
  return (
    <div className={`rounded-md border p-3 flex flex-col gap-2 ${esSuTurno && !firmante.firmado ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{firmante.orden}</span>
            <span className="text-sm font-semibold">{firmante.rol}</span>
            {firmante.firmado
              ? <Badge className="bg-secondary/15 text-secondary border-0 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Firmado</Badge>
              : esperandoTurno
                ? <Badge variant="outline" className="text-[10px]">Esperando turno</Badge>
                : <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Turno actual</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{firmante.cargo}</p>
          {(firmante.nombre || firmante.rfc) && (
            <p className="text-xs mt-1">
              {firmante.nombre ?? "—"}
              {firmante.rfc && <span className="text-muted-foreground ml-1 font-mono">({firmante.rfc})</span>}
              {firmante.fecha_firma && <span className="text-muted-foreground ml-2">{new Date(firmante.fecha_firma).toLocaleString("es-MX")}</span>}
            </p>
          )}
          {firmante.cargo_firmante && (
            <p className="text-xs mt-0.5 text-muted-foreground italic">Cargo capturado: {firmante.cargo_firmante}</p>
          )}
        </div>
      </div>

      {modo === "externo" && !firmante.firmado && link && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="text-[10px] font-mono" />
            <Button size="sm" variant="outline" onClick={onCopiar} className="gap-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" />{copiadoId === firmante.id ? "Copiado" : "Copiar"}
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerar} disabled={regenerando === firmante.id} className="gap-1.5 shrink-0">
              {regenerando === firmante.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerar
            </Button>
          </div>
          {esperandoTurno && (
            <p className="text-[10px] text-muted-foreground">Este link sólo será válido cuando los anteriores firmen.</p>
          )}
        </div>
      )}

      {modo === "interno" && !firmante.firmado && esCurrent && esSuTurno && (
        <Button size="sm" onClick={onFirmar} className="self-start bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          <Shield className="h-4 w-4" /> Firmar mi parte
        </Button>
      )}
    </div>
  )
}
