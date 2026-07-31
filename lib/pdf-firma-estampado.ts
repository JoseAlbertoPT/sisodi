import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont, PDFEmbeddedPage, degrees } from "pdf-lib"
import QRCode from "qrcode"
import path from "path"
import fs from "fs/promises"
import { createHash } from "crypto"

export interface FirmaPortal {
  /** RFC del firmante */
  usuario: string
  /** Rol del firmante (ej. "Elaboró", "Revisó") */
  rolFirmante: string | null
  /** Nombre completo del firmante */
  responsable: string | null
  selloDigital: string | null
  estampadoTiempo: string | null
  selloEstampadoTiempo: string | null
  noCertificado: string | null
  noCertificadoGEM: string | null
  rfcGEM: string | null
  urlValidacion: string | null
  firmadoEn?: string | Date | null
  /** Cargo institucional (solo se usa en modo bypass / bd local) */
  cargo?: string | null
}

export interface AgregarConstanciaOpts {
  pdfBase: Buffer | Uint8Array
  firmas: FirmaPortal[]
  nombreArchivo: string
  folio?: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 42
const FOOTER_RESERVE = 130

const cVerde      = rgb(40/255, 60/255, 42/255)
const cOliva      = rgb(110/255, 121/255, 90/255)
const cCafe       = rgb(198/255, 156/255, 109/255)
const cCafeSoft   = rgb(246/255, 238/255, 226/255)
const cCafeBorder = rgb(227/255, 203/255, 174/255)
const cVino       = rgb(131/255, 40/255, 86/255)
const cArena      = rgb(243/255, 242/255, 238/255)
const cArenaDark  = rgb(236/255, 234/255, 227/255)
const cTinta      = rgb(40/255, 60/255, 42/255)
const cTinta2     = rgb(63/255, 79/255, 64/255)
const cTexto      = rgb(134/255, 133/255, 126/255)
const cRule       = rgb(218/255, 215/255, 203/255)
const cRuleSoft   = rgb(232/255, 229/255, 217/255)
const cBlanco     = rgb(1, 1, 1)
const cVerdeSoft  = rgb(29/255, 44/255, 31/255)

interface DrawContext {
  pdfDoc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  fontBold: PDFFont
  logoImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
}

/* ── Utilidades de texto ── */

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return []
  const lines: string[] = []
  const words = String(text).split(/\s+/)
  let current = ""
  for (const w of words) {
    const test = current ? current + " " + w : w
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = ""
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            if (chunk) lines.push(chunk)
            chunk = ch
          } else chunk += ch
        }
        current = chunk
      } else current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxW: number): string {
  if (!text) return ""
  if (font.widthOfTextAtSize(text, size) <= maxW) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1)
  return t + "…"
}

function formatFecha(value: string | Date | null | undefined): string {
  if (!value) return ""
  try {
    const d = typeof value === "string" ? new Date(value) : value
    if (isNaN(d.getTime())) return String(value)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    return `${dd}/${mm}/${yy} · ${hh}:${mi}`
  } catch { return String(value) }
}

let logoBytesPromise: Promise<Buffer | null> | null = null

function getLogoBytes(): Promise<Buffer | null> {
  if (!logoBytesPromise) {
    logoBytesPromise = fs
      .readFile(path.join(process.cwd(), "public", "logo-20finanzas.png"))
      .catch(() => null)
  }
  return logoBytesPromise
}

async function generarQRPng(text: string, size = 220): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png", errorCorrectionLevel: "M",
    margin: 1, width: size,
    color: { dark: "#1a1208", light: "#FFFFFF" },
  })
}

/* ── Banda lateral + watermark ── */

function drawBandaLateral(page: PDFPage): void {
  const bandaW = 6
  const altoTercio = PAGE_H / 3
  page.drawRectangle({ x: 0, y: PAGE_H - altoTercio, width: bandaW, height: altoTercio, color: cVerde })
  page.drawRectangle({ x: 0, y: altoTercio, width: bandaW, height: altoTercio, color: cOliva })
  page.drawRectangle({ x: 0, y: 0, width: bandaW, height: altoTercio, color: cCafe })
}

function drawWatermark(page: PDFPage, font: PDFFont): void {
  const text = "eFirma"
  page.drawText(text, {
    x: 110, y: 280,
    size: 140, font, color: cCafe,
    opacity: 0.06,
    rotate: degrees(-22),
  })
}

function drawFondo(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: cArena })
}

/* ── Manejo de páginas ── */

function nuevaPaginaConstancia(ctx: DrawContext, conTitulo: boolean): void {
  const page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H])
  drawFondo(page)
  drawBandaLateral(page)
  drawWatermark(page, ctx.fontBold)
  ctx.page = page
  ctx.y = PAGE_H - 50

  if (conTitulo) {
    const fechaHoy = (() => {
      const d = new Date()
      const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
      return `${String(d.getDate()).padStart(2, "0")} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
    })()
    const horaHoy = (() => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    })()
    const folio = `FOLIO · EF-${new Date().getFullYear()}-${String(new Date().getTime()).slice(-4)}`

    if (ctx.logoImage) {
      const logoH = 32
      const ratio = ctx.logoImage.width / ctx.logoImage.height
      const logoW = logoH * ratio
      ctx.page.drawImage(ctx.logoImage, {
        x: MARGIN, y: ctx.y - logoH + 4, width: logoW, height: logoH,
      })
    }

    const folioW = ctx.font.widthOfTextAtSize(folio, 7)
    ctx.page.drawText(folio, { x: PAGE_W - MARGIN - folioW, y: ctx.y - 2, size: 7, font: ctx.font, color: cTexto })
    const fechaW = ctx.fontBold.widthOfTextAtSize(fechaHoy, 9)
    ctx.page.drawText(fechaHoy, { x: PAGE_W - MARGIN - fechaW, y: ctx.y - 13, size: 9, font: ctx.fontBold, color: cTinta })
    const horaText = `Hora del sello · ${horaHoy}`
    const horaW = ctx.font.widthOfTextAtSize(horaText, 6.5)
    ctx.page.drawText(horaText, { x: PAGE_W - MARGIN - horaW, y: ctx.y - 23, size: 6.5, font: ctx.font, color: cTexto })

    ctx.y -= 38

    const tituloText = "Constancia de Firma Electrónica"
    const tituloW = ctx.fontBold.widthOfTextAtSize(tituloText, 14)
    ctx.page.drawText(tituloText, { x: (PAGE_W - tituloW) / 2, y: ctx.y, size: 14, font: ctx.fontBold, color: cVerde })
    ctx.y -= 14
  }
}

function ensureSpace(ctx: DrawContext, needed: number): void {
  if (ctx.y - needed < FOOTER_RESERVE) {
    nuevaPaginaConstancia(ctx, false)
  }
}

/* ── Ficha del documento (doc-card) ── */

function drawDocCard(ctx: DrawContext, nombreArchivo: string, huella: string, total: number): void {
  const cardX = MARGIN
  const cardW = PAGE_W - MARGIN * 2
  const cardH = 50

  ctx.page.drawRectangle({
    x: cardX, y: ctx.y - cardH, width: cardW, height: cardH,
    color: cCafeSoft, borderColor: cRule, borderWidth: 0.6,
  })

  const metaX = cardX + 10
  const labelW = 70
  const valueX = metaX + labelW
  const valueMaxW = cardW - labelW - 145
  let my = ctx.y - 12

  ctx.page.drawText("ARCHIVO", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cCafe })
  ctx.page.drawText(truncateToWidth(nombreArchivo, ctx.fontBold, 7.5, valueMaxW), { x: valueX, y: my, size: 7.5, font: ctx.fontBold, color: cTinta })
  my -= 12

  ctx.page.drawText("HUELLA SHA-256", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cCafe })
  ctx.page.drawText(truncateToWidth(huella, ctx.font, 6.5, valueMaxW), { x: valueX, y: my, size: 6.5, font: ctx.font, color: cTinta2 })
  my -= 12

  ctx.page.drawText("ESTATUS", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cCafe })
  ctx.page.drawText("SELLO ACTIVO · Documento íntegro", { x: valueX, y: my, size: 7.5, font: ctx.fontBold, color: cOliva })

  const divX = cardX + cardW - 115
  ctx.page.drawLine({
    start: { x: divX, y: ctx.y - 6 },
    end:   { x: divX, y: ctx.y - cardH + 6 },
    thickness: 0.5, color: cRule,
  })

  const stackXEnd = cardX + cardW - 10

  const pillText = "VIGENTE"
  const pillSize = 6.5
  const pillTextW = ctx.fontBold.widthOfTextAtSize(pillText, pillSize)
  const pillH = 11
  const pillW = pillTextW + 16
  const pillY = ctx.y - 14
  ctx.page.drawRectangle({
    x: stackXEnd - pillW, y: pillY - pillH + 4, width: pillW, height: pillH, color: cOliva,
  })
  ctx.page.drawCircle({ x: stackXEnd - pillW + 6, y: pillY - 2, size: 1.8, color: cBlanco })
  ctx.page.drawText(pillText, {
    x: stackXEnd - pillW + 11, y: pillY - 4, size: pillSize, font: ctx.fontBold, color: cBlanco,
  })

  const countText = String(total).padStart(2, "0")
  const countSize = 18
  const countW = ctx.fontBold.widthOfTextAtSize(countText, countSize)
  ctx.page.drawText(countText, {
    x: stackXEnd - countW, y: ctx.y - 40, size: countSize, font: ctx.fontBold, color: cCafe,
  })
  const subText = "FIRMAS"
  const subW = ctx.font.widthOfTextAtSize(subText, 5)
  ctx.page.drawText(subText, {
    x: stackXEnd - subW, y: ctx.y - 46, size: 5, font: ctx.fontBold, color: cTexto,
  })

  ctx.y -= cardH + 8
}

/* ── Section head numerado ── */

function drawSectionHead(ctx: DrawContext, num: string, titulo: string): void {
  const numText = `§ ${num}`
  ctx.page.drawText(numText, { x: MARGIN, y: ctx.y, size: 8, font: ctx.fontBold, color: cCafe })
  const numW = ctx.fontBold.widthOfTextAtSize(numText, 8)

  const titX = MARGIN + numW + 12
  ctx.page.drawText(titulo.toUpperCase(), { x: titX, y: ctx.y, size: 11, font: ctx.fontBold, color: cVerde })
  const titW = ctx.fontBold.widthOfTextAtSize(titulo.toUpperCase(), 11)

  const lineX0 = titX + titW + 12
  const lineX1 = PAGE_W - MARGIN
  ctx.page.drawLine({
    start: { x: lineX0, y: ctx.y + 4 },
    end:   { x: lineX1, y: ctx.y + 4 },
    thickness: 0.5, color: cRule,
  })

  ctx.y -= 14
}

/* ── Tarjeta de firmante ── */

function colorPorRol(rol: string): { bg: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> } {
  const r = rol.toLowerCase()
  if (r.includes("revis")) return { bg: cOliva, text: cBlanco }
  if (r.includes("verific")) return { bg: cVerde, text: cBlanco }
  if (r.includes("emiti") || r.includes("emit")) return { bg: cVino, text: cBlanco }
  return { bg: cCafe, text: cBlanco }
}

function alturaFirmanteCard(firma: FirmaPortal, font: PDFFont, fontBold: PDFFont, innerW: number): number {
  const sealFontSize = 4
  const lineGap = sealFontSize + 1
  let h = 8
  h += 14
  h += 12
  h += 22
  h += 4
  if (firma.selloDigital) {
    h += 8
    const lines = wrapText(firma.selloDigital, font, sealFontSize, innerW - 8)
    h += lines.length * lineGap + 5
    h += 2
  }
  if (firma.rfcGEM || firma.noCertificadoGEM) h += 11
  if (firma.selloEstampadoTiempo) {
    h += 8
    const lines = wrapText(firma.selloEstampadoTiempo, font, sealFontSize, innerW - 8)
    h += lines.length * lineGap + 5
    h += 2
  }
  h += 5
  return h
}

function drawFirmanteCard(
  ctx: DrawContext,
  firma: FirmaPortal,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const padX = 10
  const innerX = x + padX
  const innerW = w - padX * 2

  ctx.page.drawRectangle({
    x, y: y - h, width: w, height: h,
    color: cBlanco, borderColor: cRule, borderWidth: 0.5,
  })
  ctx.page.drawRectangle({
    x, y: y - h, width: 2, height: h, color: cCafe,
  })

  let cy = y - 12

  const numCenter = { x: innerX + 7, y: cy + 1 }
  ctx.page.drawCircle({
    x: numCenter.x, y: numCenter.y, size: 6,
    color: cCafeSoft, borderColor: cCafeBorder, borderWidth: 0.4,
  })
  const numText = String(index + 1)
  const numTW = ctx.fontBold.widthOfTextAtSize(numText, 6.5)
  ctx.page.drawText(numText, {
    x: numCenter.x - numTW / 2, y: numCenter.y - 2,
    size: 6.5, font: ctx.fontBold, color: cCafe,
  })

  const rol = (firma.rolFirmante || "Firmante").trim()
  const rolUpper = rol.toUpperCase()
  const { bg: roleBg, text: roleText } = colorPorRol(rol)
  const rolFontSize = 5.5
  const rolW = ctx.fontBold.widthOfTextAtSize(rolUpper, rolFontSize) + 8
  const rolH = 9
  const rolX = innerX + 17
  const rolY = cy - 3
  ctx.page.drawRectangle({
    x: rolX, y: rolY, width: rolW, height: rolH, color: roleBg,
  })
  ctx.page.drawText(rolUpper, {
    x: rolX + 4, y: rolY + 2, size: rolFontSize, font: ctx.fontBold, color: roleText,
  })

  const cargo = (firma.cargo || "").trim()
  if (cargo) {
    const cargoText = cargo.toUpperCase()
    const cargoStartX = rolX + rolW + 5
    const cargoMaxW = innerX + innerW - cargoStartX
    const cargoTrunc = truncateToWidth(cargoText, ctx.fontBold, 5.5, cargoMaxW)
    const lw = ctx.fontBold.widthOfTextAtSize(cargoTrunc, 5.5)
    ctx.page.drawText(cargoTrunc, {
      x: innerX + innerW - lw, y: cy, size: 5.5, font: ctx.fontBold, color: cTinta2,
    })
  }

  cy -= 14

  const nombre = (firma.responsable || firma.usuario || "Sin nombre").trim()
  const nombreTrunc = truncateToWidth(nombre, ctx.fontBold, 9, innerW)
  ctx.page.drawText(nombreTrunc, {
    x: innerX, y: cy, size: 9, font: ctx.fontBold, color: cVerde,
  })
  cy -= 12

  const dlLabelW = 32
  const dlValueX = innerX + dlLabelW
  const dlValueMaxW = innerW - dlLabelW
  const drawDlRow = (label: string, value: string, valueColor = cTinta2) => {
    ctx.page.drawText(label, { x: innerX, y: cy, size: 5, font: ctx.fontBold, color: cTexto })
    ctx.page.drawText(truncateToWidth(value, ctx.font, 6.5, dlValueMaxW), {
      x: dlValueX, y: cy, size: 6.5, font: ctx.font, color: valueColor,
    })
    cy -= 7
  }
  if (firma.usuario) drawDlRow("RFC", firma.usuario)
  if (firma.noCertificado) drawDlRow("CERT.", firma.noCertificado)
  const fechaFirma = formatFecha(firma.estampadoTiempo || firma.firmadoEn)
  if (fechaFirma) drawDlRow("FIRMADO", fechaFirma, cTinta)

  cy -= 2
  ctx.page.drawLine({
    start: { x: innerX, y: cy + 2 },
    end:   { x: innerX + innerW, y: cy + 2 },
    thickness: 0.3, color: cRule, opacity: 0.5,
  })
  cy -= 4

  const drawSealHash = (label: string, hash: string) => {
    ctx.page.drawText(label.toUpperCase(), { x: innerX, y: cy, size: 5.5, font: ctx.fontBold, color: cCafe })
    cy -= 8

    const sealFontSize = 4
    const lineGap = sealFontSize + 1
    const padInner = 3
    const lines = wrapText(hash, ctx.font, sealFontSize, innerW - padInner * 2)
    const blobH = lines.length * lineGap + 5
    ctx.page.drawRectangle({
      x: innerX, y: cy - blobH + lineGap, width: innerW, height: blobH,
      color: cArenaDark, borderColor: cRuleSoft, borderWidth: 0.3,
    })
    let by = cy
    for (const ln of lines) {
      ctx.page.drawText(ln, { x: innerX + padInner, y: by, size: sealFontSize, font: ctx.font, color: cTexto })
      by -= lineGap
    }
    cy -= blobH + 1
  }

  if (firma.selloDigital) {
    drawSealHash("Sello digital", firma.selloDigital)
  }

  if (firma.rfcGEM || firma.noCertificadoGEM) {
    const parts: string[] = []
    if (firma.rfcGEM) parts.push(`GEM: ${firma.rfcGEM}`)
    if (firma.noCertificadoGEM) parts.push(`Cert: ${firma.noCertificadoGEM}`)
    const line = parts.join("  ·  ")
    ctx.page.drawText(truncateToWidth(line, ctx.font, 5.5, innerW), {
      x: innerX, y: cy, size: 5.5, font: ctx.font, color: cTinta2,
    })
    cy -= 9
  }

  if (firma.selloEstampadoTiempo) {
    drawSealHash("Sello GEM", firma.selloEstampadoTiempo)
  }
}

function drawFirmantesGrid(ctx: DrawContext, firmas: FirmaPortal[]): void {
  const cols = firmas.length >= 2 ? 2 : 1
  const totalW = PAGE_W - MARGIN * 2
  const colGap = 10
  const cardW = cols === 2 ? (totalW - colGap) / 2 : totalW
  const padX = 14
  const innerW = cardW - padX * 2

  for (let i = 0; i < firmas.length; i += cols) {
    const fila = firmas.slice(i, i + cols)
    const alturaFila = Math.max(...fila.map(f => alturaFirmanteCard(f, ctx.font, ctx.fontBold, innerW)))

    if (ctx.y - alturaFila < FOOTER_RESERVE) {
      nuevaPaginaConstancia(ctx, false)
    }

    fila.forEach((firma, k) => {
      const x = MARGIN + k * (cardW + colGap)
      drawFirmanteCard(ctx, firma, i + k, x, ctx.y, cardW, alturaFila)
    })

    ctx.y -= alturaFila + 10
  }
}

/* ── Sección de validación (fondo verde oscuro) ── */

function drawValidacion(
  ctx: DrawContext,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  urlValidacion: string,
): void {
  const blockH = 80
  const blockX = MARGIN
  const blockW = PAGE_W - MARGIN * 2
  const blockY = 56

  ctx.page.drawRectangle({
    x: blockX, y: blockY, width: blockW, height: blockH, color: cVerde,
  })

  const qrSize = 62
  const qrX = blockX + 12
  const qrY = blockY + (blockH - qrSize) / 2
  ctx.page.drawRectangle({
    x: qrX - 3, y: qrY - 3, width: qrSize + 6, height: qrSize + 6, color: cBlanco,
  })
  if (qrImage) {
    ctx.page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }

  const bodyX = qrX + qrSize + 16
  const bodyW = blockW - (bodyX - blockX) - 12
  let by = blockY + blockH - 14

  ctx.page.drawText("VALIDACIÓN DEL DOCUMENTO", {
    x: bodyX, y: by, size: 7, font: ctx.fontBold, color: cCafe,
  })
  by -= 11

  ctx.page.drawText("Verifique integridad y autoría", {
    x: bodyX, y: by, size: 10, font: ctx.fontBold, color: cBlanco,
  })
  by -= 13

  if (urlValidacion) {
    const urlOne = truncateToWidth(urlValidacion, ctx.font, 7, bodyW - 10)
    ctx.page.drawRectangle({
      x: bodyX, y: by - 3, width: bodyW, height: 11,
      color: cVerdeSoft, opacity: 0.6,
    })
    ctx.page.drawText(urlOne, { x: bodyX + 4, y: by, size: 7, font: ctx.font, color: cCafe })
    by -= 14
  }

  const legal = "Documento firmado mediante firma electrónica avanzada. Verifique integridad y autoría escaneando el QR."
  const legalLines = wrapText(legal, ctx.font, 6.5, bodyW)
  for (const ln of legalLines.slice(0, 2)) {
    ctx.page.drawText(ln, { x: bodyX, y: by, size: 6.5, font: ctx.font, color: cArenaDark })
    by -= 8
  }

}

/* ── Footer ── */

function drawFooter(ctx: DrawContext, uuid: string | null): void {
  const footY = 32
  ctx.page.drawLine({
    start: { x: MARGIN, y: footY + 14 },
    end:   { x: PAGE_W - MARGIN, y: footY + 14 },
    thickness: 0.4, color: cRule,
  })

  ctx.page.drawCircle({ x: MARGIN + 3, y: footY + 4, size: 2, color: cCafe })
  ctx.page.drawText("Documento generado automáticamente · eFirma v3.2", {
    x: MARGIN + 10, y: footY, size: 7, font: ctx.fontBold, color: cTexto,
  })

  const uuidShort = uuid ? `${uuid.slice(0, 4)}…${uuid.slice(-5)}` : ""
  const rightText = uuidShort ? `Página 1 · UUID ${uuidShort}` : "Página 1"
  const rW = ctx.fontBold.widthOfTextAtSize(rightText, 7)
  ctx.page.drawText(rightText, {
    x: PAGE_W - MARGIN - rW, y: footY, size: 7, font: ctx.fontBold, color: cTexto,
  })
}

/* ──────────────────────────────────────────────
 * API pública
 * ────────────────────────────────────────────── */

export async function agregarConstanciaFirma(opts: AgregarConstanciaOpts): Promise<Uint8Array> {
  const { pdfBase, firmas, nombreArchivo } = opts

  const pdfDoc = await PDFDocument.load(pdfBase)
  const huella = createHash("sha256").update(Buffer.from(pdfBase)).digest("hex")

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const urlValidacion = firmas.find((f) => !!f.urlValidacion)?.urlValidacion || ""
  let qrImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  if (urlValidacion) {
    try {
      const png = await generarQRPng(urlValidacion, 240)
      qrImage = await pdfDoc.embedPng(png)
    } catch {
      qrImage = null
    }
  }

  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoBytes = await getLogoBytes()
    if (logoBytes) logoImage = await pdfDoc.embedPng(logoBytes)
  } catch {
    logoImage = null
  }

  const ctx: DrawContext = {
    pdfDoc,
    page: null as unknown as PDFPage,
    y: 0,
    font,
    fontBold,
    logoImage,
  }
  nuevaPaginaConstancia(ctx, true)

  drawDocCard(ctx, nombreArchivo, huella, firmas.length)

  drawFirmantesGrid(ctx, firmas)

  drawValidacion(ctx, qrImage, urlValidacion)

  const uuid = firmas[0]?.urlValidacion?.match(/uuid=([a-f0-9]+)/i)?.[1] ?? null
  drawFooter(ctx, uuid)

  return pdfDoc.save()
}
