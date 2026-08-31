import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
import { resolveQuetzalliSansPath } from "@/lib/pdf-fonts";

// El "Pág. X de Y" del encabezado de la página principal de Justificación
// (components/plantillas/PlantillaJustificacionServicios.tsx, s.pageBox) usa
// el `render` prop de react-pdf para calcular pageNumber/totalPages en
// tiempo de layout — ese mecanismo no produce ningún texto en esa posición
// específica del documento (bug de react-pdf verificado, no depende del
// contenido ni de fixed/wrap/estilo; la misma técnica sí funciona en la
// sección de Dictamen embebida más adelante en el mismo documento). Como
// workaround, se genera el PDF normalmente (con esa caja vacía) y luego se
// "estampa" el texto encima con pdf-lib, ya con el conteo de páginas real.
//
// mainPageCount = cuántas páginas físicas ocupa la sección de Justificación
// (antes de que empiece, si existe, la sección de Dictamen embebida) — cada
// una de esas páginas repite la misma caja fija en la esquina superior
// derecha y necesita su propio "Pág. N de total".
export async function stampPaginaPrincipal(
  pdfBytes: Buffer | Uint8Array,
  mainPageCount: number,
  // Total a mostrar en "Pág. X de {total}". Por defecto el conteo real del
  // PDF final (incluida, si existe, la Constancia de Firma Electrónica que
  // agregarConstanciaFirma pega al final) — pero ese total puede no calzar
  // con el "de N" que ya trae impreso la sección de Dictamen embebida más
  // adelante (ese "de N" se calculó con react-pdf ANTES de pegar la
  // constancia, y no se puede recalcular). Pasar `totalPageCountOverride`
  // con ese mismo N pre-constancia mantiene ambos números consistentes.
  totalPageCountOverride?: number,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPageCount = totalPageCountOverride ?? pdfDoc.getPageCount();

  // El resto del documento usa QuetzalliSans (react-pdf) — sin esto, este
  // texto estampado con pdf-lib se ve en Helvetica, una tipografía distinta
  // a simple vista al lado del resto del encabezado.
  const quetzalliPath = resolveQuetzalliSansPath();
  let font;
  if (quetzalliPath) {
    pdfDoc.registerFontkit(fontkit);
    font = await pdfDoc.embedFont(readFileSync(quetzalliPath), { subset: true });
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  const fontSize = 8;
  const pages = pdfDoc.getPages();

  for (let i = 0; i < mainPageCount && i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const text = `Pág. ${i + 1} de ${totalPageCount}`;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    // Caja headerCol3 > pageBox: ver estilos headerTable/headerCol3/pageBox
    // en PlantillaJustificacionServicios.tsx. Página carta (612x792); estos
    // valores replican esa geometría (no dependen de `width`/`height` reales
    // porque el tamaño de página siempre es LETTER, pero se calculan a
    // partir de esas variables por si cambiara).
    const headerTop = 18; // page.paddingTop(30) + headerTable.marginTop(-12)
    const headerHeight = 40; // alto aproximado de headerTable (contenido de headerCol2)
    const col3Right = width - 22; // page.paddingHorizontal(40) - headerTable.marginRight(-18)
    const col3Width = width * 0.25 - 2; // headerCol3 25% del ancho de headerTable, ajustado
    const col3Left = col3Right - col3Width;
    const pageBoxCenterX = col3Left + col3Width / 2;
    const pageBoxCenterYFromTop = headerTop + headerHeight * 0.75; // mitad inferior de headerTable

    page.drawText(text, {
      x: pageBoxCenterX - textWidth / 2,
      y: height - pageBoxCenterYFromTop - fontSize * 0.35,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const stamped = await pdfDoc.save();
  return Buffer.from(stamped);
}
