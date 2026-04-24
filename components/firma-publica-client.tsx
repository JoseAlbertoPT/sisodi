"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Shield, CheckCircle2, Loader2, AlertCircle, Clock,
  FileKey, KeyRound, FileText, Briefcase, AlertTriangle,
} from "lucide-react"

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

type Fase = "cargando" | "aviso" | "firmando" | "exito" | "expirado" | "otra_sesion" | "invalido" | "completado"

interface Props { uuid: string; token: string }

export function FirmaPublicaClient({ uuid, token }: Props) {
  const [fase, setFase] = useState<Fase>("cargando")
  const [expiraEn, setExpiraEn] = useState<Date | null>(null)
  const [segundosRestantes, setSegundosRestantes] = useState<number>(0)
  const [accediendo, setAccediendo] = useState(false)
  const [firmanteInfo, setFirmanteInfo] = useState<{ rol: string; cargo: string } | null>(null)

  const [usuario, setUsuario] = useState("")
  const [cargo, setCargo] = useState("")
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<{ firmados: number; estado: string } | null>(null)
  const [avisoCargoAbierto, setAvisoCargoAbierto] = useState(false)
  const [cargoHabilitado, setCargoHabilitado] = useState(false)
  const cargoInputRef = useRef<HTMLInputElement | null>(null)

  const aceptarAvisoCargo = () => {
    setAvisoCargoAbierto(false)
    setCargoHabilitado(true)
    setTimeout(() => cargoInputRef.current?.focus(), 50)
  }

  useEffect(() => {
    if (fase !== "firmando" || !expiraEn) return
    const tick = () => {
      const ms = expiraEn.getTime() - Date.now()
      if (ms <= 0) { setSegundosRestantes(0); setFase("expirado"); return }
      setSegundosRestantes(Math.floor(ms / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fase, expiraEn])

  // Al montar: consulta el estado del link y decide qué pantalla mostrar
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/firma-efirma/link-info?uuid=${encodeURIComponent(uuid)}&t=${encodeURIComponent(token)}`, { cache: "no-store" })
        const json = await res.json()
        if (cancelled) return
        if (json?.firmante) setFirmanteInfo(json.firmante)
        const st = json?.status as string | undefined
        if (st === "en_curso_mi_sesion" && json.expira_en) {
          setExpiraEn(new Date(json.expira_en))
          setFase("firmando")
        } else if (st === "otra_sesion")   setFase("otra_sesion")
        else if (st === "expirado")        setFase("expirado")
        else if (st === "completado")      setFase("completado")
        else if (st === "invalido")        setFase("invalido")
        else                                setFase("aviso")
      } catch {
        if (!cancelled) setFase("aviso")
      }
    })()
    return () => { cancelled = true }
  }, [uuid, token])

  const handleAcceder = async () => {
    setAccediendo(true); setError(null)
    try {
      const res = await fetch("/api/firma-efirma/acceder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, token }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        if (res.status === 410)      { setFase("expirado");    return }
        if (res.status === 423)      { setFase("otra_sesion"); return }
        setError(json.error ?? "No se pudo acceder")
        return
      }
      setExpiraEn(new Date(json.expira_en))
      setFase("firmando")
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setAccediendo(false)
    }
  }

  const handleFirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cerFile || !keyFile || !password || !usuario || !cargo.trim()) {
      setError("Completa todos los campos"); return
    }
    setError(null); setTrabajando(true)
    try {
      const [cerB64, keyB64] = await Promise.all([fileToBase64(cerFile), fileToBase64(keyFile)])
      const res = await fetch("/api/firma-efirma/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid, token,
          usuario: usuario.toUpperCase(),
          cargoFirmante: cargo.trim(),
          certificado: cerB64, clavePrivada: keyB64, fraseClavePrivada: password,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        if (res.status === 410) setFase("expirado")
        setError(json.error ?? "Error al firmar"); return
      }
      setExito({ firmados: json.firmados, estado: json.estado })
      setFase("exito")
    } catch (e: any) {
      setError(e?.message ?? "Error de conexión")
    } finally {
      setTrabajando(false)
    }
  }

  const mmss = useMemo(() => {
    const m = Math.floor(segundosRestantes / 60)
    const s = segundosRestantes % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }, [segundosRestantes])

  if (fase === "cargando") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando link...
        </div>
      </div>
    )
  }

  if (fase === "otra_sesion") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-accent/40 border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <AlertCircle className="h-10 w-10 text-accent-foreground" />
            <h2 className="text-lg font-semibold">Link en uso</h2>
            <p className="text-sm text-muted-foreground text-center">
              Este link ya fue abierto por otra persona y estamos esperando a que firme. Si tú eres quien debe firmar, solicita un nuevo link al responsable.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "invalido") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40 border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">Link inválido</h2>
            <p className="text-sm text-muted-foreground text-center">
              El link no existe o el token no es correcto. Pide uno nuevo al responsable.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "completado") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-secondary/40 border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <CheckCircle2 className="h-10 w-10 text-secondary" />
            <h2 className="text-lg font-semibold">Proceso completado</h2>
            <p className="text-sm text-muted-foreground text-center">Todas las firmas ya fueron registradas. Ya puedes cerrar esta pestaña.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "aviso") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg border-2 border-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-accent-foreground" />
              Aviso importante antes de firmar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>Estás por acceder al documento para firmarlo electrónicamente.</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>Al presionar <span className="font-semibold text-card-foreground">Acceder</span> se iniciará un cronómetro de <span className="font-semibold text-card-foreground">30 minutos</span>.</li>
                <li>Si no firmas en ese tiempo, el link se vencerá y deberás pedir uno nuevo al responsable.</li>
                <li>Solo una persona debe usar este link. No lo compartas.</li>
                <li>Necesitarás tu <span className="font-semibold text-card-foreground">certificado (.cer)</span>, <span className="font-semibold text-card-foreground">clave privada (.key)</span> y contraseña de tu e.firma.</li>
              </ul>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.close()}>Cancelar</Button>
              <Button onClick={handleAcceder} disabled={accediendo}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                {accediendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Acceder y comenzar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "expirado") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40 border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <Clock className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">Link expirado</h2>
            <p className="text-sm text-muted-foreground text-center">
              El plazo de 30 minutos para firmar se agotó. Solicita un nuevo link al responsable del proceso.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "exito" && exito) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-secondary/40 border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <CheckCircle2 className="h-14 w-14 text-secondary" />
            <h2 className="text-lg font-semibold">¡Firma registrada!</h2>
            <p className="text-sm text-muted-foreground text-center">
              Tu firma quedó registrada correctamente.{" "}
              {exito.estado === "completado"
                ? "El proceso está completo."
                : `Se han recibido ${exito.firmados} firmas hasta ahora.`}
            </p>
            <p className="text-xs text-muted-foreground">Ya puedes cerrar esta pestaña.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // fase === "firmando" — layout 2 columnas
  const pdfSrc = `/api/firma-efirma/pdf?uuid=${encodeURIComponent(uuid)}&t=${encodeURIComponent(token)}`
  const timerColor =
    segundosRestantes > 10 * 60 ? "text-secondary" :
    segundosRestantes > 5 * 60  ? "text-accent-foreground" :
    "text-destructive"

  return (
    <div className="min-h-screen flex flex-col">
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
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-card-foreground">Firma de Justificación</h1>
            <p className="text-xs text-muted-foreground">Portal de firma electrónica — Dirección de Organización</p>
          </div>
          <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-mono ${timerColor}`}>
            <Clock className="h-4 w-4" /> {mmss}
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        <div className="border-r p-6 overflow-y-auto flex flex-col gap-4">
          {firmanteInfo && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Estás firmando como</p>
              <p className="text-lg font-semibold text-card-foreground mt-0.5">{firmanteInfo.rol}</p>
              <p className="text-xs text-muted-foreground mt-2">Cargo que respaldas con tu firma:</p>
              <p className="text-sm text-card-foreground mt-0.5">{firmanteInfo.cargo}</p>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-primary" /> Firmar con e.firma
              </CardTitle>
              <CardDescription className="text-xs">
                Revisa el documento a la derecha y completa tus credenciales para firmar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFirmar} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">RFC del firmante</Label>
                  <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="RFC (13 caracteres)" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
                  <Input
                    ref={cargoInputRef}
                    value={cargo}
                    readOnly={!cargoHabilitado}
                    onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                    onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                    onChange={e => setCargo(e.target.value.toUpperCase())}
                    placeholder="EJ. DIRECTOR DE RECURSOS HUMANOS"
                    className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""}`}
                    autoComplete="off"
                    name="cargo-firmante-externo"
                  />
                  <p className="text-[10px] text-accent-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Escriba su cargo correctamente. Aparecerá impreso junto a su firma en el PDF.
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
                <Button type="submit" disabled={trabajando}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 self-end mt-2">
                  {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Firmar ahora
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/30 p-3 flex flex-col min-h-[60vh] lg:min-h-0">
          <div className="flex items-center gap-2 px-2 pb-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Documento a firmar
          </div>
          <iframe src={pdfSrc} className="flex-1 w-full rounded-md border bg-background" title="Documento a firmar" />
        </div>
      </div>
    </div>
  )
}
