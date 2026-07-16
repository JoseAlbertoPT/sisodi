"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FirmaAutografaPanel } from "@/components/firma-autografa-panel"
import { FirmaElectronicaTabs } from "@/components/firma-electronica-tabs"
import type { SelladoEtapa } from "@/components/sellado-documento-section"
import { FileSignature, AlertCircle } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  solicitudId: number
  folioJustificacion: string
  folioRecepcion?: string | null
  folioDictamen?: string | null
  modalidadFirma: "electronica" | "autografa" | null | undefined
  currentUserId: string
  onGenerarPdf: () => Promise<void> | void
  onGenerarPdfBase64: () => Promise<string>
  onFinalizar: () => Promise<void>
  guardandoFinal: boolean
  selladoEtapa?: SelladoEtapa
}

export function FirmaModal({
  open, onClose, solicitudId, folioJustificacion, folioRecepcion, folioDictamen, modalidadFirma,
  currentUserId,
  onGenerarPdf, onGenerarPdfBase64, onFinalizar, guardandoFinal,
  selladoEtapa,
}: Props) {
  const [finalizando, setFinalizando] = useState(false)
  const [compacto, setCompacto] = useState(true)
  const [procesoIniciado, setProcesoIniciado] = useState(false)
  const [exito, setExito] = useState(false)

  const handleFinalizar = async () => {
    setFinalizando(true)
    try { await onFinalizar() } finally { setFinalizando(false); onClose() }
  }

  const esElectronica = modalidadFirma === "electronica"
  const esAutografa   = modalidadFirma === "autografa"
  const sinModalidad  = !esElectronica && !esAutografa

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent
        className={`overflow-y-auto font-sans ${compacto ? "sm:max-w-md max-h-[75vh]" : "sm:max-w-3xl max-h-[85vh]"}`}
        showCloseButton={false}
      >
        {!exito && (
          <DialogHeader>
            <DialogTitle className="ds-title-md flex items-center gap-3 leading-tight text-[color:var(--color-core-piedra-20)]">
              {esElectronica ? <img src="/iconos2/Shield.svg" alt="" className="h-5 w-5 shrink-0" /> : <FileSignature className="h-5 w-5 text-secondary" />}
              <span className="flex flex-col gap-0.5">
                <span className={esElectronica && !procesoIniciado ? "text-base font-light" : "font-light"}>
                  {esElectronica && !procesoIniciado ? "Iniciar Proceso de Firmar dictamen" : "Firmar dictamen"} — {folioDictamen ?? <span className="italic text-gray-500">sin folio</span>}
                </span>
                <span className="font-sans text-sm font-light leading-[1.3] text-gray-500">
                  Justificación: {folioJustificacion}
                  {folioRecepcion && <> · Folio Recepción: {folioRecepcion}</>}
                </span>
              </span>
            </DialogTitle>
          </DialogHeader>
        )}

        {sinModalidad && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-sans text-sm font-light text-destructive">Modalidad no definida</p>
              <p className="font-sans text-xs font-light text-gray-500 mt-1">
                Esta solicitud no tiene modalidad de firma registrada. Regrese al paso de Emisión, apruebe seleccionando la modalidad correspondiente e intente de nuevo.
              </p>
            </div>
          </div>
        )}

        {esAutografa && (
          <FirmaAutografaPanel
            solicitudId={solicitudId}
            folioJustificacion={folioJustificacion}
            currentUserId={currentUserId}
            onGenerarPdf={onGenerarPdf}
            onFinalizar={handleFinalizar}
            onCancelar={onClose}
            guardandoFinal={finalizando || guardandoFinal}
          />
        )}

        {esElectronica && (
          <FirmaElectronicaTabs
            solicitudId={solicitudId}
            folioJustificacion={folioJustificacion}
            folioDictamen={folioDictamen}
            currentUserId={currentUserId}
            onGenerarPdfBase64={onGenerarPdfBase64}
            onFinalizar={handleFinalizar}
            onCancelar={onClose}
            guardandoFinal={finalizando || guardandoFinal}
            selladoEtapa={selladoEtapa}
            onCompactoChange={setCompacto}
            onProcesoIniciadoChange={setProcesoIniciado}
            onExitoChange={setExito}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
