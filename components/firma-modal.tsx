"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FirmaAutografaPanel } from "@/components/firma-autografa-panel"
import { FirmaElectronicaTabs } from "@/components/firma-electronica-tabs"
import { Shield, FileSignature, AlertCircle } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  solicitudId: number
  folioJustificacion: string
  folioRecepcion?: string | null
  modalidadFirma: "electronica" | "autografa" | null | undefined
  currentUserId: string
  onGenerarPdf: () => Promise<void> | void
  onGenerarPdfBase64: () => Promise<string>
  onFinalizar: () => Promise<void>
  guardandoFinal: boolean
}

export function FirmaModal({
  open, onClose, solicitudId, folioJustificacion, folioRecepcion, modalidadFirma,
  currentUserId,
  onGenerarPdf, onGenerarPdfBase64, onFinalizar, guardandoFinal,
}: Props) {
  const [finalizando, setFinalizando] = useState(false)

  const handleFinalizar = async () => {
    setFinalizando(true)
    try { await onFinalizar() } finally { setFinalizando(false); onClose() }
  }

  const esElectronica = modalidadFirma === "electronica"
  const esAutografa   = modalidadFirma === "autografa"
  const sinModalidad  = !esElectronica && !esAutografa

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {esElectronica ? <Shield className="h-5 w-5 text-primary" /> : <FileSignature className="h-5 w-5 text-secondary" />}
            <span className="flex flex-col gap-0.5">
              <span>Firmar justificación — {folioJustificacion}</span>
              {folioRecepcion && <span className="text-xs font-normal text-muted-foreground">Folio Recepción: {folioRecepcion}</span>}
            </span>
          </DialogTitle>
        </DialogHeader>

        {sinModalidad && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Modalidad no definida</p>
              <p className="text-xs text-muted-foreground mt-1">
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
            guardandoFinal={finalizando || guardandoFinal}
          />
        )}

        {esElectronica && (
          <FirmaElectronicaTabs
            solicitudId={solicitudId}
            folioJustificacion={folioJustificacion}
            currentUserId={currentUserId}
            onGenerarPdfBase64={onGenerarPdfBase64}
            onFinalizar={handleFinalizar}
            guardandoFinal={finalizando || guardandoFinal}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
