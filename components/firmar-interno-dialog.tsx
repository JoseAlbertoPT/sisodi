"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, FileKey, KeyRound, Briefcase, AlertCircle } from "lucide-react"
// import { SelladoDocumentoSection } from "@/components/sellado-documento-section"

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
  const [confirmFirmarYEmitirAbierto, setConfirmFirmarYEmitirAbierto] = useState(false)
  const [ultimoCargo, setUltimoCargo] = useState<string | null>(null)
  /** En el flujo del emisor: pasa a true cuando ya se firmó electrónicamente
   *  pero aún falta subir el sellado y emitir. */
  const [firmaCompleta, setFirmaCompleta] = useState(!!iniciarEnSellado)
  const [emitiendo, setEmitiendo] = useState(false)
  const [camposInvalidos, setCamposInvalidos] = useState({ cargo: false, cer: false, key: false, password: false })
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
    setConfirmFirmarYEmitirAbierto(false)
    setFirmaCompleta(false)
    setEmitiendo(false)
    setCamposInvalidos({ cargo: false, cer: false, key: false, password: false })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalidos = {
      cargo: !cargo.trim(),
      cer: !cerFile,
      key: !keyFile,
      password: !password,
    }
    setCamposInvalidos(invalidos)
    if (invalidos.cargo || invalidos.cer || invalidos.key || invalidos.password) {
      setError("Completa cargo, .cer, .key y contraseña"); return
    }
    setError(null)
    if (requiereSellado) {
      setConfirmFirmarYEmitirAbierto(true)
      return
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
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al firmar"); return }

      setExito(true)
      setTimeout(() => { onFirmado?.(); reset(); onClose() }, 1500)
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setTrabajando(false)
    }
  }

  const ejecutarFirmaYEmitir = async () => {
    setConfirmFirmarYEmitirAbierto(false)
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
          skipEmit: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al firmar"); return }

      if (!solicitudId) { setError("Falta el identificador de la solicitud"); return }
      const resEmitir = await fetch("/api/firma-efirma/emitir-dictamen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, usuarioId }),
      })
      const jsonEmitir = await resEmitir.json()
      if (!resEmitir.ok || !jsonEmitir.ok) { setError(jsonEmitir.error ?? "Error al emitir"); return }

      setExito(true)
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
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setEmitiendo(false)
    }
  }

  const descargarDictamen = async () => {
    if (!solicitudId) return
    try {
      const res = await fetch("/api/pdf/justificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId }),
      })
      if (!res.ok) throw new Error("No se pudo generar el dictamen")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${`Dictamen_${folioDictamen ?? folio ?? solicitudId}`.replace(/[/\\]+/g, "-")}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message ?? "No se pudo descargar el dictamen")
    }
  }

  const cerrarExito = () => { onFirmado?.(); reset(); onClose() }

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
    <ConfirmAlertDialog
      open={confirmFirmarYEmitirAbierto}
      onOpenChange={setConfirmFirmarYEmitirAbierto}
      onConfirm={ejecutarFirmaYEmitir}
      title="Confirmar firma y emisión"
      description={<>
        ¿Estás seguro de firmar y emitir el dictamen{folio ? <> de la justificación <strong>{folio}</strong></> : null}?
        El expediente quedará <strong>bloqueado</strong> y pasará a la sección de Dictámenes.
        Esta acción <strong>no se puede revertir</strong>.
      </>}
      confirmLabel="Sí, firmar y emitir"
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
    <ConfirmationModal
      open={exito}
      type="success"
      title={requiereSellado ? "¡Dictamen emitido!" : "¡Firma registrada!"}
      message={requiereSellado ? "El dictamen fue firmado y emitido correctamente." : "Tu firma quedó registrada correctamente."}
      primaryAction={requiereSellado ? { label: "Descargar dictamen", onClick: descargarDictamen } : undefined}
      secondaryAction={requiereSellado ? { label: "Regresar a bandeja", onClick: cerrarExito } : undefined}
      onClose={cerrarExito}
    />
    <Dialog open={open && !exito} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-8 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            {titulo ?? "Firmar con tu e.firma"}
          </DialogTitle>
          {subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>}
        </DialogHeader>

        {firmaCompleta ? (
          <div className="flex flex-col gap-4 px-8 pt-2 pb-6">
            {/* <div className="flex items-start gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--sem-support-success-low)" }}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ backgroundColor: "var(--sem-support-success)" }}>
                <span className="text-[12px] font-bold text-white leading-none">i</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium" style={{ color: "var(--sem-support-success)" }}>Firma registrada correctamente</p>
                <p className="text-xs font-light" style={{ color: "var(--sem-support-success)" }}>
                  Falta sellar el dictamen y emitirlo. Descargue, agregue el sello fuera del sistema y suba el archivo.
                </p>
              </div>
            </div> */}

            {/* {solicitudId && (
              <SelladoDocumentoSection
                solicitudId={solicitudId}
                etapa="emision"
                usuarioId={usuarioId}
                nombreDescarga={`Dictamen_${folioDictamen ?? folio ?? solicitudId}`.replace(/[/\\]+/g, "-")}
                className="max-w-2xl mx-auto w-full"
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
            )} */}

            {error && <p className="text-xs text-support-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="default" onClick={() => { reset(); onClose() }} disabled={emitiendo}>Cerrar</Button>
              <Button
                type="button"
                variant="vino"
                onClick={() => setConfirmEmitirAbierto(true)}
                disabled={emitiendo}
              >
                {emitiendo && <Loader2 className="h-4 w-4 animate-spin" />}
                Emitir Dictamen
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-8 pt-2 pb-6">
            {/* {esEmisor && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-support-error-low px-4 py-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-support-error">
                  <span className="text-[12px] font-bold text-white leading-none">!</span>
                </div>
                <span className="text-sm font-light text-support-error">
                  <strong className="font-medium">Firma del emisor</strong> —{" "}
                  {requiereSellado
                    ? "Después de firmar electrónicamente, deberá descargar el dictamen, sellarlo y subirlo para emitirlo."
                    : "Al firmar, el dictamen será emitido oficialmente y ya no podrá modificarse."}
                </span>
              </div>
            )} */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
              <Input
                ref={cargoInputRef}
                value={cargo}
                readOnly={!cargoHabilitado}
                tabIndex={cargoHabilitado ? undefined : -1}
                onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                onChange={e => {
                  const val = e.target.value.toUpperCase()
                  setCargo(val)
                  if (camposInvalidos.cargo && val.trim()) setCamposInvalidos(p => ({ ...p, cargo: false }))
                }}
                placeholder="EJ. DIRECTOR DE ANÁLISIS NORMATIVO"
                className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""}`}
                aria-invalid={camposInvalidos.cargo}
                autoComplete="off"
                name="cargo-firmante-interno"
              />
              {camposInvalidos.cargo ? (
                <p className="text-[10px] text-support-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Este campo es obligatorio
                </p>
              ) : (
                <p className="text-[10px] text-support-warning flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Escriba su cargo correctamente. Aparecerá impreso junto a su firma.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
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
                {cerFile && <span className="text-xs text-muted-foreground truncate">{cerFile.name}</span>}
                {camposInvalidos.cer && (
                  <p className="text-[10px] text-support-error flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Este campo es obligatorio
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
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
                {keyFile && <span className="text-xs text-muted-foreground truncate">{keyFile.name}</span>}
                {camposInvalidos.key && (
                  <p className="text-[10px] text-support-error flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Este campo es obligatorio
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Contraseña de la clave privada</Label>
              <Input
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  if (camposInvalidos.password && e.target.value) setCamposInvalidos(p => ({ ...p, password: false }))
                }}
                autoComplete="new-password"
                aria-invalid={camposInvalidos.password}
              />
              {camposInvalidos.password && (
                <p className="text-[10px] text-support-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Este campo es obligatorio
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-support-error flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
            <div className="-mx-8 -mb-6 mt-2 flex items-center justify-end gap-2 border-t border-[var(--sem-border-md)] px-6 py-4">
              <Button
                variant="default"
                className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
                onClick={() => { reset(); onClose() }}
                disabled={trabajando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="vino"
                className="rounded-full h-10 px-6 font-normal shadow-sm"
                disabled={trabajando}
              >
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" />}
                {esEmisor ? "Firmar y Emitir" : "Firmar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
