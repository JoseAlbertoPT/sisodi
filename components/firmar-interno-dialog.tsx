"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, FileKey, KeyRound, CheckCircle2, Briefcase, AlertCircle, AlertTriangle, History } from "lucide-react"
import { SelladoDocumentoSection } from "@/components/sellado-documento-section"

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

interface Props {
  open: boolean
  onClose: () => void
  firmanteId: number
  usuarioId: string
  titulo?: string
  subtitulo?: string
  bandeja?: string | null
  folio?: string | null
  /** Requerido cuando bandeja === "emision" para descargar el dictamen y subir el sellado. */
  solicitudId?: number | null
  /** Folio del dictamen (para nombrar la descarga). */
  folioDictamen?: string | null
  /** Si true, abre directo en el paso 2 (sellado + emitir). Útil cuando el usuario
   *  ya firmó pero abandonó el flujo y vuelve a entrar para terminar de emitir. */
  iniciarEnSellado?: boolean
  onFirmado?: () => void
}

export function FirmarInternoDialog({ open, onClose, firmanteId, usuarioId, titulo, subtitulo, bandeja, folio, solicitudId, folioDictamen, iniciarEnSellado, onFirmado }: Props) {
  const [cargo, setCargo] = useState("")
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [avisoCargoAbierto, setAvisoCargoAbierto] = useState(false)
  const [cargoHabilitado, setCargoHabilitado] = useState(false)
  const [confirmEmitirAbierto, setConfirmEmitirAbierto] = useState(false)
  const [selladoSubido, setSelladoSubido] = useState(false)
  const [ultimoCargo, setUltimoCargo] = useState<string | null>(null)
  /** En el flujo del emisor: pasa a true cuando ya se firmó electrónicamente
   *  pero aún falta subir el sellado y emitir. */
  const [firmaCompleta, setFirmaCompleta] = useState(!!iniciarEnSellado)
  const [emitiendo, setEmitiendo] = useState(false)
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open && iniciarEnSellado) setFirmaCompleta(true)
  }, [open, iniciarEnSellado])

  const esEmisor = bandeja === "emision"
  const requiereSellado = esEmisor && !!solicitudId

  useEffect(() => {
    if (!open || !usuarioId) return
    let cancel = false
    fetch(`/api/firma-efirma/ultimo-cargo?usuarioId=${encodeURIComponent(usuarioId)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (!cancel && j?.ok) setUltimoCargo(j.cargo ?? null) })
      .catch(() => { /* noop */ })
    return () => { cancel = true }
  }, [open, usuarioId])

  const usarUltimoCargo = () => {
    if (!ultimoCargo) return
    if (!cargoHabilitado) setCargoHabilitado(true)
    setCargo(ultimoCargo.toUpperCase())
  }

  const aceptarAvisoCargo = () => {
    setAvisoCargoAbierto(false)
    setCargoHabilitado(true)
    setTimeout(() => cargoInputRef.current?.focus(), 50)
  }

  const reset = () => {
    setCargo(""); setCerFile(null); setKeyFile(null); setPassword("")
    setError(null); setExito(false)
    setAvisoCargoAbierto(false)
    setCargoHabilitado(false)
    setConfirmEmitirAbierto(false)
    setSelladoSubido(false)
    setFirmaCompleta(false)
    setEmitiendo(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cargo.trim() || !cerFile || !keyFile || !password) {
      setError("Completa cargo, .cer, .key y contraseña"); return
    }
    await ejecutarFirma()
  }

  const ejecutarFirma = async () => {
    setTrabajando(true); setError(null)
    try {
      const [cerB64, keyB64] = await Promise.all([fileToBase64(cerFile!), fileToBase64(keyFile!)])
      const res = await fetch("/api/firma-efirma/firmar-interno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmanteId, usuarioId,
          cargoFirmante: cargo.trim(),
          certificado: cerB64, clavePrivada: keyB64, fraseClavePrivada: password,
          skipEmit: requiereSellado,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al firmar"); return }

      if (requiereSellado) {
        setFirmaCompleta(true)
        return
      }
      setExito(true)
      setTimeout(() => { onFirmado?.(); reset(); onClose() }, 1500)
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setTrabajando(false)
    }
  }

  const handleEmitirDictamen = async () => {
    if (!solicitudId) return
    setConfirmEmitirAbierto(false)
    setEmitiendo(true); setError(null)
    try {
      const res = await fetch("/api/firma-efirma/emitir-dictamen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, usuarioId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al emitir"); return }
      setExito(true)
      setTimeout(() => { onFirmado?.(); reset(); onClose() }, 1500)
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <>
    <ConfirmAlertDialog
      open={confirmEmitirAbierto}
      onOpenChange={setConfirmEmitirAbierto}
      onConfirm={handleEmitirDictamen}
      title="Confirmar emisión del dictamen"
      description={<>
        Estás a punto de emitir el dictamen{folio ? <> de la justificación <strong>{folio}</strong></> : null}.
        El expediente quedará <strong>bloqueado</strong> y pasará a la sección de Dictámenes.
        Esta acción <strong>no se puede revertir</strong>.
      </>}
      confirmLabel="Sí, emitir dictamen"
    />
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
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            {titulo ?? "Firmar con tu e.firma"}
          </DialogTitle>
          {subtitulo && <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>}
        </DialogHeader>

        {exito ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
            <p className="text-sm font-medium">
              {requiereSellado ? "¡Dictamen emitido!" : "¡Firma registrada!"}
            </p>
          </div>
        ) : firmaCompleta ? (
          <div className="flex flex-col gap-4 pt-2">
            <div className="rounded-md border border-secondary/40 bg-secondary/10 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold text-secondary">Firma registrada correctamente</p>
                <p className="text-[11px] text-muted-foreground">
                  Falta sellar el dictamen y emitirlo. Descargue, agregue el sello fuera del sistema y suba el archivo.
                </p>
              </div>
            </div>

            {solicitudId && (
              <SelladoDocumentoSection
                solicitudId={solicitudId}
                etapa="emision"
                usuarioId={usuarioId}
                nombreDescarga={`Dictamen_${folioDictamen ?? folio ?? solicitudId}`.replace(/[/\\]+/g, "-")}
                onCambio={setSelladoSubido}
                onDescargar={async () => {
                  const res = await fetch("/api/pdf/justificacion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ solicitudId }),
                  })
                  if (!res.ok) throw new Error("No se pudo generar el dictamen")
                  return await res.blob()
                }}
              />
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={emitiendo}>Cerrar</Button>
              <Button
                type="button"
                onClick={() => setConfirmEmitirAbierto(true)}
                disabled={emitiendo || !selladoSubido}
                className="gap-1.5"
              >
                {emitiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Emitir Dictamen
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
            {esEmisor && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-destructive">Firma del emisor</p>
                  <p className="text-[11px] text-muted-foreground">
                    {requiereSellado
                      ? "Después de firmar electrónicamente, deberá descargar el dictamen, sellarlo y subirlo para emitirlo."
                      : "Al firmar, el dictamen será emitido oficialmente y ya no podrá modificarse."}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
              <Input
                ref={cargoInputRef}
                value={cargo}
                readOnly={!cargoHabilitado}
                onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                onChange={e => setCargo(e.target.value.toUpperCase())}
                placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""}`}
                autoComplete="off"
                name="cargo-firmante-interno"
              />
              <p className="text-[10px] text-accent-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Escriba su cargo correctamente. Aparecerá impreso junto a su firma.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs flex items-center gap-1"><FileKey className="h-3.5 w-3.5" /> Certificado (.cer)</Label>
              <Input type="file" accept=".cer" onChange={e => setCerFile(e.target.files?.[0] ?? null)} />
              {cerFile && <span className="text-xs text-muted-foreground truncate">{cerFile.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Clave privada (.key)</Label>
              <Input type="file" accept=".key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} />
              {keyFile && <span className="text-xs text-muted-foreground truncate">{keyFile.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Contraseña de la clave privada</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={trabajando}>Cancelar</Button>
              <Button type="submit" disabled={trabajando}
                className="gap-1.5">
                {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Firmar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
