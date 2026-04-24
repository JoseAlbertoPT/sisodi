"use client"

import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, FileKey, KeyRound, CheckCircle2, Briefcase, AlertCircle, AlertTriangle } from "lucide-react"

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
  onFirmado?: () => void
}

export function FirmarInternoDialog({ open, onClose, firmanteId, usuarioId, titulo, subtitulo, bandeja, folio, onFirmado }: Props) {
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
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  const esEmisor = bandeja === "emision"

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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cargo.trim() || !cerFile || !keyFile || !password) {
      setError("Completa cargo, .cer, .key y contraseña"); return
    }
    // Si es el Emisor, primero pedir confirmación antes de firmar (acción irreversible).
    if (esEmisor && !confirmEmitirAbierto) {
      setConfirmEmitirAbierto(true)
      return
    }
    await ejecutarFirma()
  }

  const ejecutarFirma = async () => {
    setConfirmEmitirAbierto(false)
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

  return (
    <>
    <AlertDialog open={confirmEmitirAbierto} onOpenChange={setConfirmEmitirAbierto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmar emisión del dictamen
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            Estás a punto de firmar como <strong>Emisor</strong>{folio ? <> para la justificación <strong>{folio}</strong></> : null}.
            Al firmar, el <strong>dictamen será emitido</strong> de forma definitiva y pasará a la sección de Dictámenes.
            Esta acción <strong>no se puede revertir</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setConfirmEmitirAbierto(false)} disabled={trabajando}>Cancelar</Button>
          <AlertDialogAction onClick={ejecutarFirma} disabled={trabajando}>
            Sí, firmar y emitir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
            <p className="text-sm font-medium">¡Firma registrada!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
            {esEmisor && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-destructive">Acción final — emisión del dictamen</p>
                  <p className="text-[11px] text-muted-foreground">
                    Al firmar, el dictamen será emitido oficialmente y ya no podrá modificarse.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
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
