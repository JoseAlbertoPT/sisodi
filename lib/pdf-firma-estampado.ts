import { PDFDocument, PDFPage, rgb, PDFFont } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
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
// Textos de ejemplo para probar el campo DOCUMENTO en la tarjeta de firmante
// (varían por firmante solo para comparar visualmente distintos títulos).
const DOC_EJEMPLOS = [
  "DICTAMEN TÉCNICO FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS",
  "JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS SECRETARÍAS, DEPENDENCIAS Y ORGANISMOS AUXILIARES",
  "CARTA DESCRIPTIVA DE PRESTACIÓN DE SERVICIOS SECRETARÍAS, DEPENDENCIAS Y ORGANISMOS AUXILIARES",
]
// Columna izquierda (RFC/CERT/FIRMADO) vs. columna derecha (DOCUMENTO) en la tarjeta de firmante.
// 140 le da espacio suficiente a un CERT. de 21 dígitos para no truncarse.
const FIRMANTE_LEFT_COL_W = 140
const FIRMANTE_COL_GAP = 8

const cVerde      = rgb(40/255, 60/255, 42/255)
const cTinta      = rgb(40/255, 60/255, 42/255)
const cTinta2     = rgb(63/255, 79/255, 64/255)
const cTexto      = rgb(134/255, 133/255, 126/255)
const cRule       = rgb(218/255, 215/255, 203/255)
const cRuleSoft   = rgb(232/255, 229/255, 217/255)
const cBlanco     = rgb(1, 1, 1)
const cGris       = rgb(245/255, 244/255, 242/255) // --sem-bg-surface-low

// Pares fondo-pastel / texto-saturado, igual que components/ui/badge.tsx y
// components/ui/status-badge.tsx (los badges reales del sistema).
const cSuccessBg  = rgb(210/255, 250/255, 210/255) // --sem-support-success-low
const cSuccessTxt = rgb(28/255, 125/255, 41/255)   // --sem-support-success
const cPrimario   = rgb(119/255, 51/255, 87/255)   // --sem-accent-primary

interface DrawContext {
  pdfDoc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  fontBold: PDFFont
  logoImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
  marcaImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null
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

// Mismo radio que rounded-md en los badges reales (components/ui/badge.tsx,
// components/ui/status-badge.tsx): --radius (0.5rem) - 2px.
const BADGE_RADIUS = 3
// Mismo radio que rounded-xl en components/ui/card.tsx: --radius (0.5rem) + 4px.
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

// Misma marca de agua que usan los demás PDFs del sistema (ver watermarkImage
// en components/plantillas/PlantillaJustificacionServicios.tsx y las otras plantillas).
let marcaBytesPromise: Promise<Buffer | null> | null = null

function getMarcaMorelosBytes(): Promise<Buffer | null> {
  if (!marcaBytesPromise) {
    marcaBytesPromise = fs
      .readFile(path.join(process.cwd(), "public", "LOGO_MORELOS_V1.png"))
      .catch(() => null)
  }
  return marcaBytesPromise
}

// Twogether Sans es la tipografía --font-sans del sistema (public/fonts, ver app/layout.tsx).
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

/* ── Watermark ── */

function drawWatermark(page: PDFPage, marcaImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null): void {
  if (!marcaImage) return
  // Mismo tamaño que watermarkImage en las plantillas (width 600 * scale 2.5).
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

/* ── Manejo de páginas ── */

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

/* ── Ficha del documento (doc-card) ── */

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

/* ── Tarjeta de firmante ── */

function alturaFirmanteCard(firma: FirmaPortal, font: PDFFont, innerW: number): number {
  const sealFontSize = 4
  const lineGap = sealFontSize + 1
  let h = 8
  h += 14

  const dlRows = [firma.usuario, firma.noCertificado, formatFecha(firma.estampadoTiempo || firma.firmadoEn)]
    .filter(Boolean).length
  const leftColH = dlRows * 7

  const docColW = innerW - FIRMANTE_LEFT_COL_W - FIRMANTE_COL_GAP
  const maxDocLines = Math.max(...DOC_EJEMPLOS.map(t => wrapText(t, font, 5.5, docColW).length))
  const docColH = 7 + maxDocLines * 6.5

  h += Math.max(leftColH, docColH)
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
  topPad = 0,
): void {
  const padX = 10
  const innerX = x + padX
  const innerW = w - padX * 2

  drawRoundedRect(ctx.page, x, y - h, w, h, CARD_RADIUS, {
    color: cBlanco, borderColor: cRule, borderWidth: 0.5,
  })

  let cy = y - 12 - topPad

  const numCenter = { x: innerX + 7, y: cy + 1 }
  ctx.page.drawCircle({
    x: numCenter.x, y: numCenter.y, size: 6,
    color: cPrimario,
  })
  const numText = String(index + 1)
  const numTW = ctx.fontBold.widthOfTextAtSize(numText, 6.5)
  ctx.page.drawText(numText, {
    x: numCenter.x - numTW / 2, y: numCenter.y - 2,
    size: 6.5, font: ctx.fontBold, color: cBlanco,
  })

  const nombre = (firma.responsable || firma.usuario || "Sin nombre").trim()
  const nombreX = innerX + 18
  const nombreTrunc = truncateToWidth(nombre, ctx.fontBold, 9, innerW - 18)
  ctx.page.drawText(nombreTrunc, {
    x: nombreX, y: cy - 1, size: 9, font: ctx.fontBold, color: cVerde,
  })

  cy -= 14

  const leftColW = FIRMANTE_LEFT_COL_W
  const dlLabelW = 32
  const dlValueX = innerX + dlLabelW
  const dlValueMaxW = leftColW - dlLabelW
  let leftCy = cy
  const drawDlRow = (label: string, value: string, valueColor = cTinta2) => {
    ctx.page.drawText(label, { x: innerX, y: leftCy, size: 5, font: ctx.fontBold, color: cTexto })
    ctx.page.drawText(truncateToWidth(value, ctx.font, 6.5, dlValueMaxW), {
      x: dlValueX, y: leftCy, size: 6.5, font: ctx.font, color: valueColor,
    })
    leftCy -= 7
  }
  if (firma.usuario) drawDlRow("RFC", firma.usuario)
  if (firma.noCertificado) drawDlRow("CERT.", firma.noCertificado)
  const fechaFirma = formatFecha(firma.estampadoTiempo || firma.firmadoEn)
  if (fechaFirma) drawDlRow("FIRMADO", fechaFirma, cTinta)

  // TODO: es texto de ejemplo (DOC_EJEMPLOS) para probar el layout; falta cablearlo
  // al nombre real del documento cuando se defina de dónde sale ese dato por firmante.
  const docColX = innerX + leftColW + FIRMANTE_COL_GAP
  const docColW = innerX + innerW - docColX
  ctx.page.drawText("DOCUMENTO", { x: docColX, y: cy, size: 5, font: ctx.fontBold, color: cTexto })
  let docCy = cy - 7
  const docEjemplo = DOC_EJEMPLOS[index % DOC_EJEMPLOS.length]
  const docLines = wrapText(docEjemplo, ctx.font, 5.5, docColW)
  for (const ln of docLines) {
    ctx.page.drawText(ln, { x: docColX, y: docCy, size: 5.5, font: ctx.font, color: cTinta2 })
    docCy -= 6.5
  }

  cy = Math.min(leftCy, docCy)

  cy -= 2
  ctx.page.drawLine({
    start: { x: innerX, y: cy + 2 },
    end:   { x: innerX + innerW, y: cy + 2 },
    thickness: 0.3, color: cRule, opacity: 0.5,
  })
  cy -= 4

  const drawSealHash = (label: string, hash: string) => {
    ctx.page.drawText(label.toUpperCase(), { x: innerX, y: cy, size: 5.5, font: ctx.fontBold, color: cVerde })
    cy -= 8

    const sealFontSize = 4
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
    // Con una sola tarjeta ocupando todo el ancho, el alto ajustado al
    // contenido se ve chico/aplastado; se le da más aire.
    const extraAlto = cols === 1 ? 40 : 0
    const alturaFila = Math.max(...fila.map(f => alturaFirmanteCard(f, ctx.font, innerW))) + extraAlto

    if (ctx.y - alturaFila < FOOTER_RESERVE) {
      nuevaPaginaConstancia(ctx, false)
    }

    fila.forEach((firma, k) => {
      const x = MARGIN + k * (cardW + colGap)
      drawFirmanteCard(ctx, firma, i + k, x, ctx.y, cardW, alturaFila, extraAlto / 2)
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

  drawFirmantesGrid(ctx, firmas)

  drawValidacion(ctx, qrImage, urlValidacion)

  const uuid = firmas[0]?.urlValidacion?.match(/uuid=([a-f0-9]+)/i)?.[1] ?? null
  drawFooter(ctx, uuid)

  return pdfDoc.save()
}
