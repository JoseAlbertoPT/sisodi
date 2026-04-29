import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont, PDFEmbeddedPage } from "pdf-lib"
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
const MARGIN = 45
const FOOTER_RESERVE = 100 // espacio reservado al pie (membrete inferior)
const COL_GAP = 14 // separación horizontal entre tarjetas
const ROW_GAP = 4 // separación vertical entre filas de tarjetas
const ACCENT_W = 2.5

const colDark = rgb(0.15, 0.15, 0.15)
const colGray = rgb(0.4, 0.4, 0.4)
const colSoft = rgb(0.55, 0.55, 0.55)
const colLine = rgb(0.78, 0.78, 0.78)
const colBrown = rgb(0.55, 0.35, 0.2)
const colBrownSoft = rgb(0.85, 0.78, 0.7)
const colCardBg = rgb(0.985, 0.98, 0.97)

interface DrawContext {
  pdfDoc: PDFDocument
  page: PDFPage
  y: number
  membretePage: PDFEmbeddedPage | null
  font: PDFFont
  fontBold: PDFFont
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
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  } catch {
    return String(value)
  }
}

async function generarQRPng(url: string, size = 220): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  })
  const base64 = dataUrl.split(",")[1] ?? ""
  return Buffer.from(base64, "base64")
}

/* ── Manejo de páginas ── */

function nuevaPaginaConstancia(ctx: DrawContext, conTitulo: boolean): void {
  const page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H])
  if (ctx.membretePage) {
    page.drawPage(ctx.membretePage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
  }
  ctx.page = page
  ctx.y = PAGE_H - 80

  if (conTitulo) {
    const fechaHoy = (() => {
      const d = new Date()
      const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
      return `${String(d.getDate()).padStart(2, "0")} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
    })()
    const fechaW = ctx.font.widthOfTextAtSize(fechaHoy, 8.5)
    ctx.page.drawText(fechaHoy, { x: PAGE_W - MARGIN - fechaW, y: ctx.y, size: 8.5, font: ctx.font, color: colDark })
    ctx.y -= 18

    ctx.page.drawText("PLATAFORMA INTEGRAL DE FIRMA ELECTRÓNICA - eFirma", {
      x: MARGIN, y: ctx.y, size: 11, font: ctx.fontBold, color: colDark,
    })
    ctx.y -= 12
    ctx.page.drawText("Constancia de firma electrónica", {
      x: MARGIN, y: ctx.y, size: 8.5, font: ctx.font, color: colGray,
    })
    ctx.y -= 10
  }
}

function ensureSpace(ctx: DrawContext, needed: number): void {
  if (ctx.y - needed < FOOTER_RESERVE) {
    nuevaPaginaConstancia(ctx, false)
  }
}

/* ── Header del documento (compacto, líneas inline) ── */

function drawHeaderDocumento(ctx: DrawContext, nombreArchivo: string, huella: string, total: number): void {
  ctx.page.drawText("DOCUMENTO", {
    x: MARGIN, y: ctx.y, size: 8.5, font: ctx.fontBold, color: colBrown,
  })
  ctx.y -= 12

  const drawLine = (label: string, value: string, color = colDark, valueSz = 8) => {
    if (!value) return
    const labelW = ctx.fontBold.widthOfTextAtSize(label, 7.5)
    ctx.page.drawText(label, { x: MARGIN, y: ctx.y, size: 7.5, font: ctx.fontBold, color: colSoft })
    const maxValueW = PAGE_W - MARGIN * 2 - labelW - 6
    const truncado = truncateToWidth(value, ctx.font, valueSz, maxValueW)
    ctx.page.drawText(truncado, {
      x: MARGIN + labelW + 6, y: ctx.y, size: valueSz, font: ctx.font, color,
    })
    ctx.y -= 10
  }

  drawLine("ARCHIVO", nombreArchivo)
  drawLine("HUELLA SHA256", huella, colGray, 7)
  // Estatus + total en una sola línea
  ctx.page.drawText("ESTATUS", { x: MARGIN, y: ctx.y, size: 7.5, font: ctx.fontBold, color: colSoft })
  ctx.page.drawText("SELLO ACTIVO", { x: MARGIN + 42, y: ctx.y, size: 8, font: ctx.fontBold, color: colBrown })
  const totalLabel = `TOTAL DE FIRMAS: ${total}`
  const w = ctx.fontBold.widthOfTextAtSize(totalLabel, 8)
  ctx.page.drawText(totalLabel, { x: PAGE_W - MARGIN - w, y: ctx.y, size: 8, font: ctx.fontBold, color: colDark })
  ctx.y -= 14
}

/* ── Tarjeta de firmante (compacta, layout fijo) ── */

/**
 * Calcula altura aproximada que ocupará la tarjeta. Útil para alinear
 * filas en grid de 2 columnas (todas las tarjetas de la fila usan el max).
 * Toma en cuenta si el rol necesita 1 o 2 líneas según el ancho disponible.
 */
function alturaFirmanteCard(firma: FirmaPortal, fontBold: PDFFont, rolMaxW: number): number {
  const rol = (firma.rolFirmante || "Firmante").trim().toUpperCase()
  const rolLines = Math.min(2, wrapText(rol, fontBold, 8.5, rolMaxW).length || 1)

  let h = 8 // padding superior + línea acento
  h += 11 + (rolLines - 1) * 10 // header número + rol (1 o 2 líneas)
  h += 13 // nombre (1 línea bold)
  h += firma.cargo ? 11 : 0 // cargo
  h += 11 // RFC + cert (1 línea)
  h += 10 // fecha
  if (firma.selloDigital) h += 8 + 18 // label + 2 líneas valor
  if (firma.rfcGEM || firma.noCertificadoGEM) h += 10 // RFC GEM · Cert GEM
  if (firma.selloEstampadoTiempo) h += 8 + 18 // label + 2 líneas
  h += 4 // padding inferior
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
  const padX = 8
  const innerX = x + padX + ACCENT_W + 4
  const innerW = w - padX * 2 - ACCENT_W - 4

  // Fondo de la tarjeta
  ctx.page.drawRectangle({
    x, y: y - h, width: w, height: h,
    color: colCardBg,
    borderColor: colLine,
    borderWidth: 0.4,
  })

  // Barra de acento lateral
  ctx.page.drawRectangle({
    x: x + 2, y: y - h + 4, width: ACCENT_W, height: h - 8,
    color: colBrownSoft,
  })

  let cy = y - 12 // baseline tras padding

  // Header: "01.  ROL"  (rol se envuelve a 2 líneas si es necesario)
  const num = String(index + 1).padStart(2, "0")
  ctx.page.drawText(`${num}.`, { x: innerX, y: cy, size: 9, font: ctx.fontBold, color: colBrown })
  const numW = ctx.fontBold.widthOfTextAtSize(`${num}.`, 9) + 6
  const rol = (firma.rolFirmante || "Firmante").trim().toUpperCase()
  const rolLines = wrapText(rol, ctx.fontBold, 8.5, innerW - numW).slice(0, 2)
  rolLines.forEach((line, idx) => {
    ctx.page.drawText(line, {
      x: innerX + numW, y: cy - idx * 10, size: 8.5, font: ctx.fontBold, color: colBrown,
    })
  })
  cy -= 13 + (rolLines.length - 1) * 10

  // Nombre completo
  const nombre = (firma.responsable || firma.usuario || "Sin nombre").trim()
  const nombreTrunc = truncateToWidth(nombre, ctx.fontBold, 10, innerW)
  ctx.page.drawText(nombreTrunc, { x: innerX, y: cy, size: 10, font: ctx.fontBold, color: colDark })
  cy -= 12

  // Cargo (1 línea max)
  const cargo = (firma.cargo || "").trim()
  if (cargo) {
    const cargoTrunc = truncateToWidth(cargo, ctx.font, 8, innerW)
    ctx.page.drawText(cargoTrunc, { x: innerX, y: cy, size: 8, font: ctx.font, color: colGray })
    cy -= 11
  }

  // RFC + Cert. en una sola línea: "RFC: XXX  ·  Cert.: 000..."
  const partesRfc: string[] = []
  if (firma.usuario) partesRfc.push(`RFC: ${firma.usuario}`)
  if (firma.noCertificado) partesRfc.push(`Cert.: ${firma.noCertificado}`)
  if (partesRfc.length) {
    const lineaRfc = partesRfc.join("   ·   ")
    const truncRfc = truncateToWidth(lineaRfc, ctx.font, 7.5, innerW)
    ctx.page.drawText(truncRfc, { x: innerX, y: cy, size: 7.5, font: ctx.font, color: colDark })
    cy -= 10
  }

  // Fecha de firma
  const fechaFirma = formatFecha(firma.estampadoTiempo || firma.firmadoEn)
  if (fechaFirma) {
    ctx.page.drawText(`Firmado: ${fechaFirma}`, { x: innerX, y: cy, size: 7.5, font: ctx.font, color: colSoft })
    cy -= 11
  }

  // Sello digital (2 líneas max)
  if (firma.selloDigital) {
    ctx.page.drawText("SELLO DIGITAL", { x: innerX, y: cy, size: 6.5, font: ctx.fontBold, color: colSoft })
    cy -= 8
    const lines = wrapText(firma.selloDigital, ctx.font, 6.3, innerW)
    for (const line of lines.slice(0, 2)) {
      ctx.page.drawText(line, { x: innerX, y: cy, size: 6.3, font: ctx.font, color: colGray })
      cy -= 8
    }
    cy -= 1
  }

  // RFC GEM · Cert. GEM (en una línea)
  const partesGEM: string[] = []
  if (firma.rfcGEM) partesGEM.push(`RFC GEM: ${firma.rfcGEM}`)
  if (firma.noCertificadoGEM) partesGEM.push(`Cert. GEM: ${firma.noCertificadoGEM}`)
  if (partesGEM.length) {
    const lineaGEM = partesGEM.join("   ·   ")
    const truncGEM = truncateToWidth(lineaGEM, ctx.font, 7, innerW)
    ctx.page.drawText(truncGEM, { x: innerX, y: cy, size: 7, font: ctx.font, color: colDark })
    cy -= 9
  }

  // Sello digital GEM (2 líneas max)
  if (firma.selloEstampadoTiempo) {
    ctx.page.drawText("SELLO DIGITAL GEM", { x: innerX, y: cy, size: 6.5, font: ctx.fontBold, color: colSoft })
    cy -= 8
    const lines = wrapText(firma.selloEstampadoTiempo, ctx.font, 6.3, innerW)
    for (const line of lines.slice(0, 2)) {
      ctx.page.drawText(line, { x: innerX, y: cy, size: 6.3, font: ctx.font, color: colGray })
      cy -= 8
    }
  }
}

/* ── Layout en grid de 2 columnas ── */

function drawFirmantesGrid(ctx: DrawContext, firmas: FirmaPortal[]): void {
  const cols = firmas.length >= 4 ? 2 : 1
  const totalW = PAGE_W - MARGIN * 2
  const cardW = cols === 2 ? (totalW - COL_GAP) / 2 : totalW
  const padX = 8
  const innerW = cardW - padX * 2 - ACCENT_W - 4
  const numW = ctx.fontBold.widthOfTextAtSize("99.", 9) + 6
  const rolMaxW = innerW - numW

  for (let i = 0; i < firmas.length; i += cols) {
    const fila = firmas.slice(i, i + cols)
    const alturaFila = Math.max(...fila.map(f => alturaFirmanteCard(f, ctx.fontBold, rolMaxW)))

    // Si la fila no cabe en la página actual, salto
    if (ctx.y - alturaFila < FOOTER_RESERVE) {
      nuevaPaginaConstancia(ctx, false)
    }

    fila.forEach((firma, k) => {
      const x = MARGIN + k * (cardW + COL_GAP)
      drawFirmanteCard(ctx, firma, i + k, x, ctx.y, cardW, alturaFila)
    })

    ctx.y -= alturaFila + ROW_GAP
  }
}

/* ── Bloque QR + URL al final ── */

function drawBloqueQR(
  ctx: DrawContext,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  urlValidacion: string,
): void {
  const qrSize = 62
  const blockHeight = 96 // incluye espacio superior de respiración
  ensureSpace(ctx, blockHeight)

  ctx.y -= 16
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: colLine,
  })
  ctx.y -= 11

  ctx.page.drawText("VALIDACIÓN DEL DOCUMENTO", {
    x: MARGIN, y: ctx.y, size: 8.5, font: ctx.fontBold, color: colBrown,
  })
  ctx.y -= 11

  const qrX = MARGIN
  const qrY = ctx.y - qrSize
  ctx.page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  const textX = qrX + qrSize + 12
  const textMaxW = PAGE_W - MARGIN - textX
  let ly = ctx.y - 1

  ctx.page.drawText("URL DE VALIDACIÓN", {
    x: textX, y: ly, size: 7, font: ctx.fontBold, color: colSoft,
  })
  ly -= 9
  const urlLines = wrapText(urlValidacion, ctx.font, 7, textMaxW)
  for (const line of urlLines.slice(0, 2)) {
    ctx.page.drawText(line, { x: textX, y: ly, size: 7, font: ctx.fontBold, color: colDark })
    ly -= 8
  }
  ly -= 3

  const legalText = `Documento firmado mediante firma electrónica avanzada por servidor público competente, amparado en certificado digital vigente. Verifique integridad y autoría en la URL anterior o escaneando el código QR.`
  const legalLines = wrapText(legalText, ctx.font, 6.3, textMaxW)
  for (const line of legalLines.slice(0, 5)) {
    ctx.page.drawText(line, { x: textX, y: ly, size: 6.3, font: ctx.font, color: colGray })
    ly -= 7.5
  }

  ctx.y = qrY - 4
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
      const png = await generarQRPng(urlValidacion, 220)
      qrImage = await pdfDoc.embedPng(png)
    } catch {
      qrImage = null
    }
  }

  // ─── 1. Estampar QR + URL al pie de la última página existente ───
  if (qrImage && urlValidacion) {
    const ultimaPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1)
    const { width: pw } = ultimaPage.getSize()
    const qrSize = 46
    const qrX = pw - MARGIN - qrSize
    const qrY = 28
    ultimaPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

    const urlSize = 6
    const urlLines = wrapText(urlValidacion, font, urlSize, pw - MARGIN * 2 - qrSize - 20)
    let uy = qrY + qrSize - 6
    for (const line of urlLines.slice(0, 4)) {
      ultimaPage.drawText(line, { x: MARGIN, y: uy, size: urlSize, font, color: colGray })
      uy -= urlSize + 2
    }
  }

  // ─── 2. Cargar el membrete ───
  let membretePage: PDFEmbeddedPage | null = null
  try {
    const membretePath = path.join(process.cwd(), "public", "Membrete_Carta.pdf")
    const membreteBytes = await fs.readFile(membretePath)
    const embedded = await pdfDoc.embedPdf(membreteBytes, [0])
    membretePage = embedded[0]
  } catch {
    membretePage = null
  }

  // ─── 3. Construir contexto y dibujar la constancia ───
  const ctx: DrawContext = {
    pdfDoc,
    page: null as unknown as PDFPage,
    y: 0,
    membretePage,
    font,
    fontBold,
  }
  nuevaPaginaConstancia(ctx, true)

  // Línea separadora bajo el título
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 2 },
    end: { x: PAGE_W - MARGIN, y: ctx.y + 2 },
    thickness: 0.5,
    color: colLine,
  })
  ctx.y -= 12

  // Header del documento (compacto)
  drawHeaderDocumento(ctx, nombreArchivo, huella, firmas.length)

  // Línea separadora antes de las tarjetas de firmantes
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 2 },
    end: { x: PAGE_W - MARGIN, y: ctx.y + 2 },
    thickness: 0.5,
    color: colLine,
  })
  ctx.y -= 8

  // Grid de tarjetas
  drawFirmantesGrid(ctx, firmas)

  // Bloque QR final
  if (qrImage && urlValidacion) {
    drawBloqueQR(ctx, qrImage, urlValidacion)
  }

  return pdfDoc.save()
}
