import { access, mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { s3Exists, s3Upload } from "@/lib/s3"

// PDF a firmar de cada firma_proceso: en S3 bajo `firma-efirma/{uuid}.pdf`, o en
// disco (.firma-bypass/) cuando EFIRMA_BYPASS=true. Los procesos iniciados antes
// del cambio a S3 (commit 7850a29, 2026-09-18) guardaron su PDF en el portal de
// multifirma y aquí no existe — por eso se revisa antes de mostrarlo o firmarlo.
const BYPASS = process.env.EFIRMA_BYPASS === "true"
const BYPASS_DIR = join(process.cwd(), ".firma-bypass")
export const FIRMA_S3_PREFIX = "firma-efirma"

export const MENSAJE_PDF_NO_DISPONIBLE =
  "El documento de este proceso de firma no está disponible. Pida a quien inició la firma que vuelva a cargar el documento."

export function firmaPdfKey(uuid: string) {
  return `${FIRMA_S3_PREFIX}/${uuid}.pdf`
}

export async function firmaPdfDisponible(uuid: string): Promise<boolean> {
  if (BYPASS) {
    try {
      await access(join(BYPASS_DIR, `${uuid}.pdf`))
      return true
    } catch {
      return false
    }
  }
  return s3Exists(firmaPdfKey(uuid))
}

export async function guardarFirmaPdf(uuid: string, pdf: Buffer): Promise<void> {
  if (BYPASS) {
    await mkdir(BYPASS_DIR, { recursive: true })
    await writeFile(join(BYPASS_DIR, `${uuid}.pdf`), pdf)
    return
  }
  await s3Upload(firmaPdfKey(uuid), pdf, "application/pdf")
}
