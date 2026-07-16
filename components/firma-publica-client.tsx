"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  CheckCircle2, Loader2, AlertCircle, Clock,
  FileKey, KeyRound, Briefcase, Info,
} from "lucide-react"

const PdfPreview = dynamic(() => import("@/components/pdf-preview").then(m => m.PdfPreview), {
  ssr: false,
})
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
  const [documentoInfo, setDocumentoInfo] = useState<{ secretaria: string | null; tipo: string | null; fecha: string | null; folio: string | null } | null>(null)

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/firma-efirma/link-info?uuid=${encodeURIComponent(uuid)}&t=${encodeURIComponent(token)}`, { cache: "no-store" })
        const json = await res.json()
        if (cancelled) return
        if (json?.firmante) setFirmanteInfo(json.firmante)
        if (json?.documento) setDocumentoInfo(json.documento)
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

  const descargarPdfFirmado = async () => {
    try {
      const res = await fetch(`/api/firma-efirma/descargar-firmado?uuid=${encodeURIComponent(uuid)}&t=${encodeURIComponent(token)}`, { cache: "no-store" })
      if (!res.ok) return
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition") ?? ""
      const m  = cd.match(/filename="?([^"]+)"?/i)
      const filename = m?.[1] ?? "documento-firmado.pdf"
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
    } catch { /* silencio */ }
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
      descargarPdfFirmado()
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
  const camposIncompletos = error === "Completa todos los campos"
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
            <h2 className="font-sans text-lg font-light">Link en uso</h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">
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
            <h2 className="font-sans text-lg font-light text-destructive">Link inválido</h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">
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
            <h2 className="font-sans text-lg font-light">Proceso completado</h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">Todas las firmas ya fueron registradas. Ya puedes cerrar esta pestaña.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fase === "aviso") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg border-2 border-accent/30">
          <CardHeader className="flex flex-col items-start gap-3">
            <Info className="h-6 w-6 text-[#2e3b2b] shrink-0" strokeWidth={1.75} />
            <CardTitle className="font-sans text-base font-normal text-[#2e3b2b]">
              Aviso importante antes de firmar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 font-sans text-sm font-light text-[#5d5e5f]">
              <p>Estás por acceder al documento para firmarlo electrónicamente.</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>Al presionar <span className="font-medium text-[#2e3b2b]">Acceder</span> se iniciará un cronómetro de <span className="font-medium text-[#2e3b2b]">30 minutos</span>.</li>
                <li>Si no firmas en ese tiempo, el link se vencerá y deberás pedir uno nuevo al responsable.</li>
                <li>Solo una persona debe usar este link. No lo compartas.</li>
                <li>Necesitarás tu <span className="font-medium text-[#2e3b2b]">certificado (.cer)</span>, <span className="font-medium text-[#2e3b2b]">clave privada (.key)</span> y contraseña de tu e.firma.</li>
              </ul>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-between gap-6">
              <Button onClick={() => window.close()}
                className="rounded-full border-0 bg-[#ffeaea] text-[#87090c] hover:bg-[#ffeaea] hover:text-[#87090c] focus-visible:outline-[#e7b400]">
                Cancelar
              </Button>
              <Button onClick={handleAcceder} disabled={accediendo}
                className="gap-1.5 rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400]">
                {accediendo ? "Accediendo..." : "Acceder y comenzar"}
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
            <h2 className="font-sans text-lg font-light text-destructive">Link expirado</h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">
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
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d2fad2]">
              <CheckCircle2 className="h-8 w-8 text-[#1c7d29]" />
            </div>
            <h2 className="font-sans text-lg font-light text-foreground">¡Firma registrada!</h2>
            <p className="font-sans text-sm font-light text-gray-500 text-center">
              Tu firma quedó registrada correctamente.{" "}
              {exito.estado === "completado"
                ? "El proceso está completo."
                : `Se han recibido ${exito.firmados} firmas hasta ahora.`}
            </p>
            <p className="font-sans text-xs font-light text-gray-500">
              Si la descarga no inició automáticamente,{" "}
              <button onClick={descargarPdfFirmado} className="text-primary underline hover:text-primary/80">
                haz clic aquí
              </button>
              .
            </p>
            <p className="font-sans text-xs font-light text-gray-500">Ya puedes cerrar esta pestaña.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pdfSrc = `/api/firma-efirma/pdf?uuid=${encodeURIComponent(uuid)}&t=${encodeURIComponent(token)}`
  const timerColor =
    segundosRestantes > 10 * 60 ? "text-white border-white/30" :
    segundosRestantes > 5 * 60  ? "text-amber-300 border-amber-300/40" :
    "text-red-400 border-red-400/40"

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
      <header className="rounded-2xl mx-4 mt-4 overflow-hidden shrink-0 z-10" style={{ backgroundColor: "#2e3b2b" }}>
        <div className="flex items-center justify-between flex-wrap gap-y-3 px-4 sm:px-10 pt-6 pb-8">
          <div className="flex items-center min-w-0">
            <div className="shrink-0 pr-6 sm:pr-8">
              <img src="/logo-20finanzas.png" alt="Secretaría de Administración y Finanzas" className="h-10 sm:h-12 w-auto" />
            </div>
            <div className="pl-5 sm:pl-6 border-l border-white/15 min-w-0">
              <h1 className="font-sans text-base sm:text-lg font-light text-white truncate">Firma de Justificación</h1>
              <p className="font-sans text-xs sm:text-sm font-light text-white/70 truncate">Portal de firma electrónica — Dirección de Organización</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-mono font-medium shrink-0 ${timerColor}`}>
            <Clock className="h-4 w-4" /> {mmss}
          </div>
        </div>
        <div
          className="h-8 bg-repeat-x bg-center bg-contain"
          style={{ backgroundImage: "url(/banner-completo.svg)" }}
        />
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[45%_55%] gap-0 min-h-0">
        <div className="p-6 overflow-y-auto flex flex-col gap-5 no-scrollbar">
          {firmanteInfo && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <img src="/Iconos1/account_circle-user-perfil.svg" width={20} height={20} alt="" className="shrink-0" />
              <div>
                <p className="font-sans text-xs font-light uppercase tracking-wide text-gray-500">Estás firmando como</p>
                <p className="font-sans text-lg font-light text-[color:var(--color-core-piedra-20)] mt-0.5">{firmanteInfo.rol}</p>
                <p className="font-sans text-xs font-light text-gray-500 mt-3">Cargo que respaldas con tu firma:</p>
                <p className="font-sans text-sm font-light text-[color:var(--color-core-piedra-20)] mt-0.5">{firmanteInfo.cargo}</p>
              </div>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <img src="/iconos2/Shield.svg" width={20} height={20} alt="" className="shrink-0" />
                <div>
                  <CardTitle className="font-sans text-base font-light text-[color:var(--color-core-piedra-20)]">
                    Firmar con e.firma
                  </CardTitle>
                  <CardDescription className="font-sans text-xs font-light text-gray-500 mt-0.5">
                    Revisa el documento a la derecha y completa tus credenciales para firmar.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFirmar} className={`flex flex-col gap-5 ${avisoCargoAbierto ? "pointer-events-none" : ""}`}>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-sans text-xs font-light text-gray-500">RFC del firmante</Label>
                  <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="RFC (13 caracteres)" className={camposIncompletos && !usuario ? "border-destructive" : ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Cargo / Puesto</Label>
                  <Input
                    ref={cargoInputRef}
                    value={cargo}
                    readOnly={!cargoHabilitado}
                    tabIndex={cargoHabilitado ? undefined : -1}
                    onMouseDown={e => { if (!cargoHabilitado) { e.preventDefault(); setAvisoCargoAbierto(true) } }}
                    onFocus={e => { if (!cargoHabilitado) { e.target.blur(); setAvisoCargoAbierto(true) } }}
                    onChange={e => setCargo(e.target.value.toUpperCase())}
                    placeholder="EJ. DIRECTOR DE RECURSOS HUMANOS"
                    className={`uppercase ${!cargoHabilitado ? "cursor-pointer" : ""} ${camposIncompletos && !cargo.trim() ? "border-destructive" : ""}`}
                    autoComplete="off"
                    name="cargo-firmante-externo"
                  />
                  <p className="font-sans text-[10px] font-light text-accent-foreground flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Escriba su cargo correctamente. Aparecerá impreso junto a su firma en el PDF.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><FileKey className="h-3.5 w-3.5" /> Certificado (.cer)</Label>
                  <Input type="file" accept=".cer" onChange={e => setCerFile(e.target.files?.[0] ?? null)} className={camposIncompletos && !cerFile ? "border-destructive" : ""} />
                  {cerFile && (
                    <span className="font-sans text-xs font-light text-[#773357] truncate flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{cerFile.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-sans text-xs font-light text-gray-500 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Clave privada (.key)</Label>
                  <Input type="file" accept=".key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} className={camposIncompletos && !keyFile ? "border-destructive" : ""} />
                  {keyFile && (
                    <span className="font-sans text-xs font-light text-[#773357] truncate flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{keyFile.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-sans text-xs font-light text-gray-500">Contraseña de la clave privada</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className={camposIncompletos && !password ? "border-destructive" : ""} />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" disabled={trabajando}
                  className="gap-1.5 self-end mt-1 rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400]">
                  {trabajando ? "Firmando..." : "Firmar ahora"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/30 p-3 flex flex-col min-h-[50vh] lg:min-h-0">
          <div className="flex flex-col flex-1 min-h-0 mx-2 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e7eb] shrink-0">
              <FileTypeIcon name="justificacion.pdf" size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 truncate">Documento a firmar</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {documentoInfo?.secretaria ?? "—"}
                  {documentoInfo?.tipo && <> · {documentoInfo.tipo}</>}
                  {documentoInfo?.fecha && <> · {new Date(documentoInfo.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</>}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <PdfPreview fileUrl={pdfSrc} label="Cargando documento…" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
