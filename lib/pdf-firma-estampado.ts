import { PDFDocument, PDFPage, rgb, PDFFont } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import QRCode from "qrcode"
import path from "path"
import fs from "fs/promises"
import { createHash } from "crypto"

export interface FirmaPortal {
  usuario: string
  rolFirmante: string | null
  responsable: string | null
  selloDigital: string | null
  estampadoTiempo: string | null
  selloEstampadoTiempo: string | null
  noCertificado: string | null
  noCertificadoGEM: string | null
  rfcGEM: string | null
  urlValidacion: string | null
  firmadoEn?: string | Date | null
  cargo?: string | null
  documento?: string | null
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
const FIRMANTE_LEFT_COL_W = 140
const FIRMANTE_COL_GAP = 8

const cVerde      = rgb(40/255, 60/255, 42/255)
const cTinta      = rgb(40/255, 60/255, 42/255)
const cTinta2     = rgb(63/255, 79/255, 64/255)
const cTexto      = rgb(134/255, 133/255, 126/255)
const cRule       = rgb(218/255, 215/255, 203/255)
const cRuleSoft   = rgb(232/255, 229/255, 217/255)
const cBlanco     = rgb(1, 1, 1)
const cGris       = rgb(245/255, 244/255, 242/255)

const cSuccessBg  = rgb(210/255, 250/255, 210/255)
const cSuccessTxt = rgb(28/255, 125/255, 41/255)
const cPrimario   = rgb(119/255, 51/255, 87/255)

interface DrawContext {
  pdfDoc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  fontBold: PDFFont
  logoImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
  marcaImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
}


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

const BADGE_RADIUS = 3
const CARD_RADIUS = 6

function drawRoundedRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number, r: number,
  opts: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number },
): void {
  const rr = Math.min(r, w / 2, h / 2)
  const path = `M${rr},0 H${w - rr} A${rr},${rr} 0 0 1 ${w},${rr} V${h - rr} A${rr},${rr} 0 0 1 ${w - rr},${h} H${rr} A${rr},${rr} 0 0 1 0,${h - rr} V${rr} A${rr},${rr} 0 0 1 ${rr},0 Z`
  page.drawSvgPath(path, { x, y: y + h, color: opts.color, borderColor: opts.borderColor, borderWidth: opts.borderWidth })
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

let marcaBytesPromise: Promise<Buffer | null> | null = null

function getMarcaMorelosBytes(): Promise<Buffer | null> {
  if (!marcaBytesPromise) {
    marcaBytesPromise = fs
      .readFile(path.join(process.cwd(), "public", "LOGO_MORELOS_V1.png"))
      .catch(() => null)
  }
  return marcaBytesPromise
}

let sistemaFontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null

function getSistemaFontBytes(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (!sistemaFontsPromise) {
    const fontsDir = path.join(process.cwd(), "public", "fonts")
    sistemaFontsPromise = Promise.all([
      fs.readFile(path.join(fontsDir, "TwogetherSans-Regular.otf")),
      fs.readFile(path.join(fontsDir, "TwogetherSans-Bold.otf")),
    ]).then(([regular, bold]) => ({ regular, bold }))
  }
  return sistemaFontsPromise
}

export async function generarQRPng(text: string, size = 220): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png", errorCorrectionLevel: "M",
    margin: 1, width: size,
    color: { dark: "#1a1208", light: "#FFFFFF" },
  })
}


function drawWatermark(page: PDFPage, marcaImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null): void {
  if (!marcaImage) return
  const size = 1500
  page.drawImage(marcaImage, {
    x: (PAGE_W - size) / 2, y: (PAGE_H - size) / 2,
    width: size, height: size,
    opacity: 0.12,
  })
}

function drawFondo(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: cBlanco })
}


function nuevaPaginaConstancia(ctx: DrawContext, conTitulo: boolean): void {
  const page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H])
  drawFondo(page)
  drawWatermark(page, ctx.marcaImage)
  ctx.page = page
  ctx.y = PAGE_H - 50

  if (conTitulo) {
    if (ctx.logoImage) {
      const logoH = 32
      const ratio = ctx.logoImage.width / ctx.logoImage.height
      const logoW = logoH * ratio
      ctx.page.drawImage(ctx.logoImage, {
        x: MARGIN, y: ctx.y - logoH + 4, width: logoW, height: logoH,
      })
    }

    ctx.y -= 30

    const tituloText = "Constancia de Firma Electrónica"
    const tituloW = ctx.fontBold.widthOfTextAtSize(tituloText, 14)
    ctx.page.drawText(tituloText, { x: (PAGE_W - tituloW) / 2, y: ctx.y, size: 14, font: ctx.fontBold, color: cVerde })
    ctx.y -= 14
  }
}

function drawDocCard(ctx: DrawContext, nombreArchivo: string, huella: string, total: number): void {
  const cardX = MARGIN
  const cardW = PAGE_W - MARGIN * 2
  const cardH = 50

  const metaX = cardX + 10
  const labelW = 100
  const valueX = metaX + labelW
  const valueMaxW = cardW - labelW - 145
  let my = ctx.y - 12

  ctx.page.drawText("ARCHIVO", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cTexto })
  ctx.page.drawText(truncateToWidth(nombreArchivo, ctx.fontBold, 7.5, valueMaxW), { x: valueX, y: my, size: 7.5, font: ctx.fontBold, color: cTinta })
  my -= 12

  ctx.page.drawText("HUELLA DE DOCUMENTO", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cTexto })
  ctx.page.drawText(truncateToWidth(huella, ctx.font, 6.5, valueMaxW), { x: valueX, y: my, size: 6.5, font: ctx.font, color: cTinta2 })
  my -= 12

  ctx.page.drawText("MÉTODO", { x: metaX, y: my, size: 6, font: ctx.fontBold, color: cTexto })
  ctx.page.drawText("SHA-256", { x: valueX, y: my, size: 7.5, font: ctx.fontBold, color: cTinta })

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
  const pillY = ctx.y - 10
  drawRoundedRect(ctx.page, stackXEnd - pillW, pillY - pillH + 4, pillW, pillH, BADGE_RADIUS, { color: cSuccessBg })
  ctx.page.drawCircle({ x: stackXEnd - pillW + 6, y: pillY - 2, size: 1.8, color: cSuccessTxt })
  ctx.page.drawText(pillText, {
    x: stackXEnd - pillW + 11, y: pillY - 4, size: pillSize, font: ctx.fontBold, color: cSuccessTxt,
  })

  const countText = String(total).padStart(2, "0")
  const countSize = 18
  const countW = ctx.fontBold.widthOfTextAtSize(countText, countSize)
  ctx.page.drawText(countText, {
    x: stackXEnd - countW, y: ctx.y - 33, size: countSize, font: ctx.fontBold, color: cTinta,
  })
  const subText = "FIRMAS"
  const subW = ctx.font.widthOfTextAtSize(subText, 5)
  ctx.page.drawText(subText, {
    x: stackXEnd - subW, y: ctx.y - 39, size: 5, font: ctx.fontBold, color: cTexto,
  })

  ctx.y -= cardH + 8
}

function alturaFirmanteCard(firma: FirmaPortal, font: PDFFont, innerW: number, documento: string, scale = 1): number {
  const sealFontSize = 4 * scale
  const lineGap = sealFontSize + 1
  let h = 8 * scale
  h += 14 * scale

  const dlRows = [firma.usuario, firma.noCertificado, formatFecha(firma.estampadoTiempo || firma.firmadoEn)]
    .filter(Boolean).length
  const leftColH = dlRows * 7 * scale

  const leftColWScaled = FIRMANTE_LEFT_COL_W * scale
  const docColW = innerW - leftColWScaled - FIRMANTE_COL_GAP * scale
  const docLines = wrapText(documento, font, 5.5 * scale, docColW).length
  const docColH = 7 * scale + docLines * 6.5 * scale

  h += Math.max(leftColH, docColH)
  h += 4 * scale
  if (firma.selloDigital) {
    h += 8 * scale
    const lines = wrapText(firma.selloDigital, font, sealFontSize, innerW - 8 * scale)
    h += lines.length * lineGap + 5 * scale
    h += 2 * scale
  }
  if (firma.rfcGEM || firma.noCertificadoGEM) h += 11 * scale
  if (firma.selloEstampadoTiempo) {
    h += 8 * scale
    const lines = wrapText(firma.selloEstampadoTiempo, font, sealFontSize, innerW - 8 * scale)
    h += lines.length * lineGap + 5 * scale
    h += 2 * scale
  }
  h += 5 * scale
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
  documento: string,
  topPad = 0,
  scale = 1,
): void {
  const padX = 10
  const innerX = x + padX
  const innerW = w - padX * 2

  drawRoundedRect(ctx.page, x, y - h, w, h, CARD_RADIUS, {
    color: cBlanco, borderColor: cRule, borderWidth: 0.5,
  })

  let cy = y - 12 - topPad

  const numCenter = { x: innerX + 7 * scale, y: cy + 1 }
  ctx.page.drawCircle({
    x: numCenter.x, y: numCenter.y, size: 6 * scale,
    color: cPrimario,
  })
  const numText = String(index + 1)
  const numTW = ctx.fontBold.widthOfTextAtSize(numText, 6.5 * scale)
  ctx.page.drawText(numText, {
    x: numCenter.x - numTW / 2, y: numCenter.y - 2 * scale,
    size: 6.5 * scale, font: ctx.fontBold, color: cBlanco,
  })

  const nombre = (firma.responsable || firma.usuario || "Sin nombre").trim()
  const nombreX = innerX + 18 * scale
  const nombreTrunc = truncateToWidth(nombre, ctx.fontBold, 9 * scale, innerW - 18 * scale)
  ctx.page.drawText(nombreTrunc, {
    x: nombreX, y: cy - 1, size: 9 * scale, font: ctx.fontBold, color: cVerde,
  })

  cy -= 14 * scale

  const leftColW = FIRMANTE_LEFT_COL_W * scale
  const dlLabelW = 32 * scale
  const dlValueX = innerX + dlLabelW
  const dlValueMaxW = leftColW - dlLabelW
  let leftCy = cy
  const drawDlRow = (label: string, value: string, valueColor = cTinta2) => {
    ctx.page.drawText(label, { x: innerX, y: leftCy, size: 5 * scale, font: ctx.fontBold, color: cTexto })
    ctx.page.drawText(truncateToWidth(value, ctx.font, 6.5 * scale, dlValueMaxW), {
      x: dlValueX, y: leftCy, size: 6.5 * scale, font: ctx.font, color: valueColor,
    })
    leftCy -= 7 * scale
  }
  if (firma.usuario) drawDlRow("RFC", firma.usuario)
  if (firma.noCertificado) drawDlRow("CERT.", firma.noCertificado)
  const fechaFirma = formatFecha(firma.estampadoTiempo || firma.firmadoEn)
  if (fechaFirma) drawDlRow("FIRMADO", fechaFirma, cTinta)

  const docColX = innerX + leftColW + FIRMANTE_COL_GAP * scale
  const docColW = innerX + innerW - docColX
  ctx.page.drawText("DOCUMENTO", { x: docColX, y: cy, size: 5 * scale, font: ctx.fontBold, color: cTexto })
  let docCy = cy - 7 * scale
  const docLines = wrapText(documento, ctx.font, 5.5 * scale, docColW)
  for (const ln of docLines) {
    ctx.page.drawText(ln, { x: docColX, y: docCy, size: 5.5 * scale, font: ctx.font, color: cTinta2 })
    docCy -= 6.5 * scale
  }
  cy = Math.min(leftCy, docCy)
  cy -= 2 * scale
  ctx.page.drawLine({
    start: { x: innerX, y: cy + 2 },
    end:   { x: innerX + innerW, y: cy + 2 },
    thickness: 0.3, color: cRule, opacity: 0.5,
  })
  cy -= 4 * scale

  const drawSealHash = (label: string, hash: string) => {
    ctx.page.drawText(label.toUpperCase(), { x: innerX, y: cy, size: 5.5 * scale, font: ctx.fontBold, color: cVerde })
    cy -= 8 * scale

    const sealFontSize = 4 * scale
    const lineGap = sealFontSize + 1
    const padInner = 3
    const lines = wrapText(hash, ctx.font, sealFontSize, innerW - padInner * 2)
    const blobH = lines.length * lineGap + 5
    ctx.page.drawRectangle({
      x: innerX, y: cy - blobH + lineGap, width: innerW, height: blobH,
      color: cGris, borderColor: cRuleSoft, borderWidth: 0.3,
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
    ctx.page.drawText(truncateToWidth(line, ctx.font, 5.5 * scale, innerW), {
      x: innerX, y: cy, size: 5.5 * scale, font: ctx.font, color: cTinta2,
    })
    cy -= 9 * scale
  }

  if (firma.selloEstampadoTiempo) {
    drawSealHash("Sello GEM", firma.selloEstampadoTiempo)
  }
}

function drawFirmantesGrid(ctx: DrawContext, firmas: FirmaPortal[], nombreArchivo: string): void {
  const cols = firmas.length >= 2 ? 2 : 1
  const totalW = PAGE_W - MARGIN * 2
  const colGap = 10
  const cardW = cols === 2 ? (totalW - colGap) / 2 : totalW
  const padX = 14
  const innerW = cardW - padX * 2
  // Con una sola tarjeta ocupando todo el ancho sobra espacio de sobra —
  // se agranda tanto el texto (RFC, cert., sellos...) como la tarjeta en
  // sí, en vez de solo darle más aire al alto con el mismo texto chico.
  const scale = cols === 1 ? 1.4 : 1

  for (let i = 0; i < firmas.length; i += cols) {
    const fila = firmas.slice(i, i + cols)
    const extraAlto = cols === 1 ? 20 : 0
    const alturaFila = Math.max(...fila.map(f => alturaFirmanteCard(f, ctx.font, innerW, f.documento ?? nombreArchivo, scale))) + extraAlto

    if (ctx.y - alturaFila < FOOTER_RESERVE) {
      nuevaPaginaConstancia(ctx, false)
    }

    fila.forEach((firma, k) => {
      const x = MARGIN + k * (cardW + colGap)
      drawFirmanteCard(ctx, firma, i + k, x, ctx.y, cardW, alturaFila, firma.documento ?? nombreArchivo, extraAlto / 2, scale)
    })

    ctx.y -= alturaFila + 10
  }
}

/* ── Sección de validación (tarjeta clara, igual a los banners de la app) ── */

function drawValidacion(
  ctx: DrawContext,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  urlValidacion: string,
): void {
  const blockH = 84
  const blockX = MARGIN
  const blockW = PAGE_W - MARGIN * 2
  const blockY = 56
  const pad = 16

  drawRoundedRect(ctx.page, blockX, blockY, blockW, blockH, CARD_RADIUS, {
    color: cGris, borderColor: cRule, borderWidth: 0.6,
  })

  const qrBoxSize = 62
  const qrBoxX = blockX + pad
  const qrBoxY = blockY + (blockH - qrBoxSize) / 2

  drawRoundedRect(ctx.page, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, BADGE_RADIUS, {
    color: cBlanco, borderColor: cRule, borderWidth: 0.6,
  })
  if (qrImage) {
    const qrPad = 6
    const qrImgSize = qrBoxSize - qrPad * 2
    ctx.page.drawImage(qrImage, { x: qrBoxX + qrPad, y: qrBoxY + qrPad, width: qrImgSize, height: qrImgSize })
  }

  const bodyX = qrBoxX + qrBoxSize + pad
  const bodyW = blockX + blockW - pad - bodyX
  let by = blockY + blockH - 22

  ctx.page.drawText("Verifique integridad y autoría", {
    x: bodyX, y: by, size: 12, font: ctx.fontBold, color: cVerde,
  })
  by -= 15

  const legal = "Documento firmado mediante firma electrónica avanzada. Escanea el código QR o visita el siguiente enlace para validar su autenticidad."
  const legalLines = wrapText(legal, ctx.font, 7.5, bodyW)
  for (const ln of legalLines.slice(0, 2)) {
    ctx.page.drawText(ln, { x: bodyX, y: by, size: 7.5, font: ctx.font, color: cTexto })
    by -= 10
  }

  if (urlValidacion) {
    const urlOne = truncateToWidth(urlValidacion, ctx.fontBold, 7.5, bodyW)
    ctx.page.drawText(urlOne, { x: bodyX, y: by, size: 7.5, font: ctx.fontBold, color: cPrimario })
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

  ctx.page.drawCircle({ x: MARGIN + 3, y: footY + 4, size: 2, color: cVerde })
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

  pdfDoc.registerFontkit(fontkit)
  const sistemaFonts = await getSistemaFontBytes()
  // liga: false desactiva la ligadura "fi": ese glyph en Twogether Sans trae
  // mal el ancho y deja un hueco visible en palabras como "Verifique".
  const font = await pdfDoc.embedFont(sistemaFonts.regular, { features: { liga: false } })
  const fontBold = await pdfDoc.embedFont(sistemaFonts.bold, { features: { liga: false } })

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

  let marcaImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const marcaBytes = await getMarcaMorelosBytes()
    if (marcaBytes) marcaImage = await pdfDoc.embedPng(marcaBytes)
  } catch {
    marcaImage = null
  }

  const ctx: DrawContext = {
    pdfDoc,
    page: null as unknown as PDFPage,
    y: 0,
    font,
    fontBold,
    logoImage,
    marcaImage,
  }
  nuevaPaginaConstancia(ctx, true)

  drawDocCard(ctx, nombreArchivo, huella, firmas.length)

  drawFirmantesGrid(ctx, firmas, nombreArchivo)

  drawValidacion(ctx, qrImage, urlValidacion)

  const uuid = firmas[0]?.urlValidacion?.match(/uuid=([a-f0-9]+)/i)?.[1] ?? null
  drawFooter(ctx, uuid)

  return pdfDoc.save()
}
