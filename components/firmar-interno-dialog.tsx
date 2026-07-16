"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, FileKey, KeyRound, CheckCircle2, Briefcase, AlertCircle, AlertTriangle, Info, History } from "lucide-react"
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
  solicitudId?: number | null
  folioDictamen?: string | null
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
  const [firmaCompleta, setFirmaCompleta] = useState(!!iniciarEnSellado)
  const [emitiendo, setEmitiendo] = useState(false)
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open && iniciarEnSellado) setFirmaCompleta(true)
  }, [open, iniciarEnSellado])

  const esEmisor = bandeja === "emision"
  const requiereSellado = esEmisor && !!solicitudId
  const camposIncompletos = error === "Completa cargo, .cer, .key y contraseña"

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
      const [cerB64, keyB64] = await Promise.all([fileToBase64(cerFile), fileToBase64(keyFile)])
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
      onFirmado?.()
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
      onFirmado?.()
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setEmitiendo(false)
    }
  }
  const cerrarExito = () => { reset(); onClose() }
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
      confirmLabel="Emitir dictamen"
    />
    <AlertDialog open={avisoCargoAbierto} onOpenChange={setAvisoCargoAbierto}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="items-start gap-3 text-left">
          <Info className="h-6 w-6 text-[#2e3b2b]" strokeWidth={1.75} />
          <AlertDialogTitle className="ds-title-md font-light text-[color:var(--color-core-piedra-20)]">
            Antes de escribir su cargo
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans text-sm font-light leading-relaxed text-gray-500">
            Escriba su cargo con <strong className="font-medium text-[color:var(--color-core-piedra-20)]">exactitud y sin abreviaturas</strong>.
            Este texto aparecerá impreso junto a su firma en el PDF definitivo y
            <strong className="font-medium text-[color:var(--color-core-piedra-20)]"> no podrá modificarse después</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={aceptarAvisoCargo}>Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent
        className={`overflow-y-auto font-sans ${exito ? "sm:max-w-[520px] max-h-[75vh]" : "sm:max-w-[520px] max-h-[80vh]"}`}
        onOpenAutoFocus={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {!exito && (
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-base font-light flex items-center gap-2 text-[color:var(--color-core-piedra-20)]">
              <Shield className="h-4 w-4 text-primary" />
              {titulo ?? "Firmar con tu e.firma"}
            </DialogTitle>
            {subtitulo && <p className="font-sans text-xs font-light text-gray-500 mt-0.5">{subtitulo}</p>}
          </DialogHeader>
        )}
        <div className="px-6 pb-6">
        {exito ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d2fad2]">
              <CheckCircle2 className="h-8 w-8 text-[#1c7d29]" />
            </div>
            <h2 className="font-sans text-lg font-light text-foreground">
              {requiereSellado ? "¡Dictamen emitido!" : "¡Firma registrada!"}
            </h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">
              {requiereSellado
                ? "El dictamen fue sellado y emitido correctamente."
                : "Tu firma quedó registrada correctamente."}
            </p>
            <Button onClick={cerrarExito}
              className="mt-2 rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400] px-8">
              Cerrar
            </Button>
          </div>
        ) : firmaCompleta ? (
          <div className="flex flex-col gap-4 pt-2">
            <div className="rounded-md border border-secondary/40 bg-secondary/10 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <p className="font-sans text-xs font-medium text-secondary">Firma registrada correctamente</p>
                <p className="font-sans text-[11px] font-light text-gray-500">
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
              <Button onClick={() => { reset(); onClose() }} disabled={emitiendo}
                className="rounded-full border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700">
                Cerrar
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmEmitirAbierto(true)}
                disabled={emitiendo || !selladoSubido}
                className="gap-1.5 rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400]"
              >
                {emitiendo && <Loader2 className="h-4 w-4 animate-spin" />}
                Emitir Dictamen
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`flex flex-col gap-4 pt-1 ${avisoCargoAbierto ? "pointer-events-none" : ""}`}>
            {esEmisor && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="font-sans text-xs font-medium text-destructive">Firma del emisor</p>
                  <p className="font-sans text-[11px] font-light text-gray-500">
                    {requiereSellado
                      ? "Después de firmar electrónicamente, deberá descargar el dictamen, sellarlo y subirlo para emitirlo."
                      : "Al firmar, el dictamen será emitido oficialmente y ya no podrá modificarse."}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 shrink-0" /> Cargo / Puesto <span className="text-destructive">*</span></Label>
              <Input
                ref={cargoInputRef}
                value={cargo}
                readOnly={!cargoHabilitado}
                tabIndex={cargoHabilitado ? undefined : -1}
                onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                onChange={e => setCargo(e.target.value.toUpperCase())}
                placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                className={`h-8 w-full rounded-xl border px-2.5 py-1.5 text-xs font-light uppercase ${!cargoHabilitado ? "cursor-pointer" : ""} ${camposIncompletos && !cargo.trim() ? "border-destructive" : ""}`}
                autoComplete="off"
                name="cargo-firmante-interno"
              />
              <p className="font-sans text-[10px] font-light text-gray-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Escriba su cargo correctamente. Aparecerá impreso junto a su firma.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><FileKey className="h-3.5 w-3.5 shrink-0" /> Certificado (.cer) <span className="text-destructive">*</span></Label>
              <Input type="file" accept=".cer" onChange={e => setCerFile(e.target.files?.[0] ?? null)} className={`h-8 w-full rounded-xl border px-2.5 py-1.5 text-xs font-light file:mr-3 ${camposIncompletos && !cerFile ? "border-destructive" : ""}`} />
              {cerFile && (
                <span className="font-sans text-xs font-light text-[#773357] truncate flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{cerFile.name}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5 shrink-0" /> Clave privada (.key) <span className="text-destructive">*</span></Label>
              <Input type="file" accept=".key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} className={`h-8 w-full rounded-xl border px-2.5 py-1.5 text-xs font-light file:mr-3 ${camposIncompletos && !keyFile ? "border-destructive" : ""}`} />
              {keyFile && (
                <span className="font-sans text-xs font-light text-[#773357] truncate flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{keyFile.name}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-sans text-xs font-light text-gray-500">Contraseña de la clave privada <span className="text-destructive">*</span></Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className={`h-8 w-full rounded-xl border px-2.5 py-1.5 text-xs font-light ${camposIncompletos && !password ? "border-destructive" : ""}`} />
            </div>

            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => { reset(); onClose() }} disabled={trabajando}
                className="rounded-full border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700">
                Cancelar
              </Button>
              <Button type="submit" disabled={trabajando}
                className="gap-1.5 rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400]">
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" />}
                Firmar
              </Button>
            </div>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
