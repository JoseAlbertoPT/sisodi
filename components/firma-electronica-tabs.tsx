"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import {
  CheckCircle2, Loader2, Shield,
  AlertCircle, Users, Lock, Briefcase, FileKey, KeyRound, X,
} from "lucide-react"
import { SelladoDocumentoSection, type SelladoEtapa } from "@/components/sellado-documento-section"

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
  folioDictamen?: string | null
  currentUserId: string
  onGenerarPdfBase64: () => Promise<string>
  onFinalizar: () => Promise<void> | void
  guardandoFinal: boolean
  selladoEtapa?: SelladoEtapa
  onCancelar?: () => void
}

export function FirmaElectronicaTabs({
  solicitudId,
  folioJustificacion,
  folioDictamen,
  currentUserId,
  onGenerarPdfBase64,
  onFinalizar,
  guardandoFinal,
  selladoEtapa,
  onCancelar,
}: Props) {
  const [selladoSubido, setSelladoSubido] = useState(false)
  const [firma, setFirma] = useState<FirmaProceso | null>(null)
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const [iniciando, setIniciando] = useState(false)
  const [copiadoId, setCopiadoId] = useState<number | null>(null)
  const [regenerando, setRegenerando] = useState<number | null>(null)
  const [firmandoInline, setFirmandoInline] = useState<number | null>(null)
  const [firmaExitosa, setFirmaExitosa] = useState(false)

  const [cargoFirma, setCargoFirma] = useState("")
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [fraseKey, setFraseKey] = useState("")
  const [firmandoTrabajo, setFirmandoTrabajo] = useState(false)
  const [firmandoError, setFirmandoError] = useState<string | null>(null)
  const [avisoCargoAbierto, setAvisoCargoAbierto] = useState(false)
  const [cargoHabilitado, setCargoHabilitado] = useState(false)
  const [ultimoCargo, setUltimoCargo] = useState<string | null>(null)
  const [camposInvalidos, setCamposInvalidos] = useState({ cargo: false, cer: false, key: false, password: false })
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  const resetFirmandoInline = () => {
    setFirmandoInline(null)
    setCargoFirma(""); setCerFile(null); setKeyFile(null); setFraseKey("")
    setFirmandoError(null); setCargoHabilitado(false); setAvisoCargoAbierto(false)
    setCamposInvalidos({ cargo: false, cer: false, key: false, password: false })
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
    const invalidos = {
      cargo: !cargoFirma.trim(),
      cer: !cerFile,
      key: !keyFile,
      password: !fraseKey,
    }
    setCamposInvalidos(invalidos)
    if (invalidos.cargo || invalidos.cer || invalidos.key || invalidos.password) {
      setFirmandoError("Completa cargo, .cer, .key y contraseña"); return
    }
    setFirmandoTrabajo(true); setFirmandoError(null)
    try {
      const [cerB64, keyB64] = await Promise.all([fileToBase64(cerFile!), fileToBase64(keyFile!)])
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
      setFirmaExitosa(true)
    } catch (e: any) {
      setFirmandoError(e?.message ?? "Error de conexión")
    } finally {
      setFirmandoTrabajo(false)
    }
  }

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/firma-efirma/estado?solicitudId=${solicitudId}`, { cache: "no-store" })
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
    if (!currentUserId) return
    let cancel = false
    fetch(`/api/firma-efirma/ultimo-cargo?usuarioId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (!cancel && j?.ok) setUltimoCargo(j.cargo ?? null) })
      .catch(() => { /* noop */ })
    return () => { cancel = true }
  }, [currentUserId])

  const usarUltimoCargo = () => {
    if (!ultimoCargo) return
    if (!cargoHabilitado) setCargoHabilitado(true)
    setCargoFirma(ultimoCargo.toUpperCase())
  }

  useEffect(() => {
    if (!firma) return
    pollRef.current = setInterval(cargar, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [firma, cargar])

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

  const copiarLink = async (firmanteId: number, link: string) => {
    if (!link) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      } else {
        const el = document.createElement("textarea")
        el.value = link
        el.style.position = "fixed"
        el.style.opacity = "0"
        document.body.appendChild(el)
        el.focus(); el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
      }
      setCopiadoId(firmanteId); setTimeout(() => setCopiadoId(null), 1500)
    } catch {
    }
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
      if (json.acceso_token && firma?.uuid) {
        const origen = typeof window !== "undefined" ? window.location.origin : ""
        const link = `${origen}/firmado/${firma.uuid}?t=${json.acceso_token}`
        await copiarLink(firmanteId, link)
      }
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
              className="gap-1.5 self-end">
              {iniciando ? "Iniciando..." : "Iniciar proceso"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const externos = firmantes.filter(f => f.tipo === "externo")
  const internosTodos = firmantes.filter(f => f.tipo === "interno")
  const miInterno = internosTodos.find(f => f.usuario_id === currentUserId) ?? null
  const internos = miInterno ? [miInterno] : internosTodos

  const siguienteFirmante = firmantes
    .filter(f => !f.firmado)
    .sort((a, b) => a.orden - b.orden)[0] ?? null
  const siguienteOrden = siguienteFirmante?.orden ?? Infinity

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
      <ConfirmationModal
        open={firmaExitosa}
        type="success"
        title="¡Firma registrada!"
        message="Tu firma quedó registrada correctamente."
        onClose={() => setFirmaExitosa(false)}
      />

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
              onCopiar={(link) => copiarLink(f.id, link)}
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
                esCurrent={f.usuario_id === currentUserId || (!f.usuario_id && f.orden === siguienteOrden)}
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
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
                    <Input
                      ref={cargoInputRef}
                      value={cargoFirma}
                      readOnly={!cargoHabilitado}
                      tabIndex={cargoHabilitado ? undefined : -1}
                      onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                      onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                      onChange={e => {
                        const val = e.target.value.toUpperCase()
                        setCargoFirma(val)
                        if (camposInvalidos.cargo && val.trim()) setCamposInvalidos(p => ({ ...p, cargo: false }))
                      }}
                      placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                      className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""}`}
                      aria-invalid={camposInvalidos.cargo}
                      autoComplete="off"
                      name="cargo-firmante-uefa"
                    />
                    {camposInvalidos.cargo ? (
                      <p className="text-[10px] text-support-error flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Este campo es obligatorio
                      </p>
                    ) : (
                      <p className="text-[10px] text-support-warning flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Escriba su cargo correctamente. Aparecerá impreso junto a su firma.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs flex items-center gap-1"><FileKey className="h-3.5 w-3.5" /> Certificado (.cer)</Label>
                      <Input
                        type="file" accept=".cer"
                        aria-invalid={camposInvalidos.cer}
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null
                          setCerFile(f)
                          if (camposInvalidos.cer && f) setCamposInvalidos(p => ({ ...p, cer: false }))
                        }}
                      />
                      {camposInvalidos.cer && (
                        <p className="text-[10px] text-support-error flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Este campo es obligatorio
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Clave privada (.key)</Label>
                      <Input
                        type="file" accept=".key"
                        aria-invalid={camposInvalidos.key}
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null
                          setKeyFile(f)
                          if (camposInvalidos.key && f) setCamposInvalidos(p => ({ ...p, key: false }))
                        }}
                      />
                      {camposInvalidos.key && (
                        <p className="text-[10px] text-support-error flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Este campo es obligatorio
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Contraseña de la clave privada</Label>
                    <Input
                      type="password"
                      value={fraseKey}
                      onChange={e => {
                        setFraseKey(e.target.value)
                        if (camposInvalidos.password && e.target.value) setCamposInvalidos(p => ({ ...p, password: false }))
                      }}
                      autoComplete="new-password"
                      aria-invalid={camposInvalidos.password}
                    />
                    {camposInvalidos.password && (
                      <p className="text-[10px] text-support-error flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Este campo es obligatorio
                      </p>
                    )}
                  </div>
                  {firmandoError && (
                    <p className="text-xs text-support-error flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {firmandoError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="default" onClick={resetFirmandoInline} disabled={firmandoTrabajo}>
                      Cancelar
                    </Button>
                    <Button variant="vino" onClick={() => handleFirmarInline(f.id)} disabled={firmandoTrabajo}>
                      {firmandoTrabajo && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {selladoEtapa && puedeContinuar && (
        <SelladoDocumentoSection
          solicitudId={solicitudId}
          etapa={selladoEtapa}
          usuarioId={currentUserId}
          nombreDescarga={`Dictamen_${folioDictamen ?? folioJustificacion}_firmado`.replace(/[/\\]+/g, "-")}
          onCambio={setSelladoSubido}
          onDescargar={async () => {
            const b64 = await onGenerarPdfBase64()
            const bin = atob(b64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return new Blob([bytes], { type: "application/pdf" })
          }}
        />
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancelar && (
          <Button type="button" variant="default" onClick={onCancelar} disabled={guardandoFinal}>
            Cancelar
          </Button>
        )}
        <Button
          variant="vino"
          onClick={() => onFinalizar()}
          disabled={!puedeContinuar || guardandoFinal || (!!selladoEtapa && !selladoSubido)}
        >
          {guardandoFinal ? "Enviando..." : "Enviar"}
        </Button>
      </div>

      <ConfirmDialog
        open={avisoCargoAbierto}
        onClose={() => setAvisoCargoAbierto(false)}
        onConfirm={aceptarAvisoCargo}
        variant="default"
        title="Antes de escribir su cargo"
        description={<>
          Escriba su cargo con <strong>exactitud y sin abreviaturas</strong>.
          Este texto aparecerá impreso junto a su firma en el PDF definitivo y
          <strong> no podrá modificarse después</strong>.
        </>}
        confirmLabel="Entendido"
        hideCancel
      />
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
  onCopiar?: (link: string) => void
  onRegenerar?: () => void
  esSuTurno?: boolean
  esCurrent?: boolean
  onFirmar?: () => void
}) {
  const link = uuid && firmante.acceso_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/firmado/${uuid}?t=${firmante.acceso_token}`
    : ""
  const esperandoTurno = !firmante.firmado && !esSuTurno
  const rolMostrar = firmante.bandeja === "uefa" && !/uefa/i.test(firmante.rol)
    ? `${firmante.rol} (UEFA)`
    : firmante.rol
  return (
    <div className={`rounded-md border p-3 flex flex-col gap-2 ${esSuTurno && !firmante.firmado ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{firmante.orden}</span>
            <span className="text-sm font-semibold">{rolMostrar}</span>
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
            <Button size="sm" variant="outline" onClick={() => onCopiar?.(link)} className="gap-1.5 shrink-0">
              {copiadoId === firmante.id ? "Copiado" : "Copiar"}
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerar} disabled={regenerando === firmante.id} className="gap-1.5 shrink-0">
              {regenerando === firmante.id ? "Regenerando..." : "Regenerar"}
            </Button>
          </div>
          {esperandoTurno && (
            <p className="text-[10px] text-muted-foreground">Este link sólo será válido cuando los anteriores firmen.</p>
          )}
        </div>
      )}

      {modo === "interno" && !firmante.firmado && esCurrent && esSuTurno && (
        <Button size="sm" onClick={onFirmar} className="self-start gap-1.5">
          Firmar mi parte
        </Button>
      )}
    </div>
  )
}
