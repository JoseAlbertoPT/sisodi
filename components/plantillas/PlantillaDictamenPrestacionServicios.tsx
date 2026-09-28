import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import React from "react";
import { resolveQuetzalliSansPath, resolveQuetzalliSansBoldPath, registerPdfNoHyphenation } from "@/lib/pdf-fonts";
import { FauxBoldText } from "@/components/plantillas/faux-bold-text";

registerPdfNoHyphenation();

const quetzalliPath = resolveQuetzalliSansPath();
if (quetzalliPath) {
  Font.register({
    family: "QuetzalliSans",
    fonts: [
      { src: quetzalliPath },
      { src: quetzalliPath, fontStyle: "italic" },
    ],
  });
}
const FONT_REGULAR = quetzalliPath ? "QuetzalliSans" : "Helvetica";
const quetzalliBoldPath = quetzalliPath ? resolveQuetzalliSansBoldPath() : null;
if (quetzalliBoldPath) {
  Font.register({ family: "QuetzalliSansBold", src: quetzalliBoldPath });
}
const FONT_BOLD = quetzalliBoldPath ? "QuetzalliSansBold" : quetzalliPath ? "QuetzalliSans" : "Helvetica-Bold";

const NOTA_DICTAMEN_DEFAULT =
  "Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable.";

export interface DictamenPrestacionData {
  folio: string;
  /** Solo en reutilización desde Catálogo: `folio` pasa a ser el "Folio de
   *  origen" y este es el folio propio de esta emisión. Mientras DGDO define su
   *  formato, es el folio de origen + "-N" (número de reutilización). */
  folioActual?: string;
  fecha: string;
  secretariaDependencia: string;
  unidadResponsableGasto: string;
  unidadAdministrativa: string;
  regimenContratacion: string;
  tipoServicios: string;
  claveNombrePrograma: string;
  objetoContratacion: string;
  importeBruto: string;
  tipoPagoLabel?: string;
  justificacion: string;
  numeroPrestadores: number;
  vigenciaInicio: string;
  vigenciaFin: string;
  formatoDoc?: string;
  claveDoc?: string;
  anexoDoc?: string;
  referenciaDoc?: string;
  revisionDoc?: string;
  notaDictamen?: string;
}

const LOGO_FINANZAS = fs.readFileSync(path.join(process.cwd(), "public/logo-20finanzas.png"));
const MARCA_MORELOS = fs.readFileSync(path.join(process.cwd(), "public/LOGO_MORELOS_V1.png"));

const PALABRAS_MENORES = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u",
  "en", "a", "al", "con", "por", "para",
]);

function toTitleCaseES(input: string): string {
  if (!input) return input;
  let wordIndex = 0;
  return input.toLocaleLowerCase("es").replace(/[\p{L}\p{N}]+/gu, (word) => {
    const capitalized =
      wordIndex > 0 && PALABRAS_MENORES.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1);
    wordIndex++;
    return capitalized;
  });
}

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 90,
    paddingHorizontal: 40,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    color: "#000",
    position: "relative",
  },
  pageFrame: {
    position: "absolute",
    top: 18,
    left: 22,
    right: 22,
    bottom: 75,
    borderWidth: 1,
    borderColor: "#000",
  },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.12,
    zIndex: -1,
  },
  watermarkImage: {
    width: 600,
    height: "auto",
    transform: "scale(2.5)",
    objectFit: "contain",
  },

  headerTable: {
    flexDirection: "row",
    marginTop: -12,
    marginLeft: -18,
    marginRight: -18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#000",
  },
  headerCol1: {
    width: "22%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  logo: { width: 100, height: "auto" },
  headerCol2: {
    width: "53%",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  headerTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.6,
  },
  headerCol3: {
    width: "25%",
    flexDirection: "column",
  },
  folioBox: {
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 34,
  },
  folioText: { fontSize: 8, textAlign: "left" },
  folioSubText: { fontSize: 7, textAlign: "center", color: "#333" },
  pageBox: { padding: 4, justifyContent: "center", minHeight: 16 },
  pageText: { fontSize: 8, textAlign: "left" },

  fechaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  fechaText: { fontSize: 9 },

  fieldRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-end",
  },
  fieldLabel: {
    width: "30%",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
  },
  fieldLabelBox: {
    width: "30%",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  fieldValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    paddingBottom: 1,
    paddingHorizontal: 2,
    minHeight: 12,
  },

  regimenRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "center",
  },
  regimenLabel: {
    width: "30%",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginRight: 6,
  },
  regimenBoxes: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkboxRect: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "#000",
    marginHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkText: { fontSize: 8, fontFamily: "Helvetica-Bold" , letterSpacing: 0.6},
  checkLabel: { fontSize: 9, marginRight: 20 },

  fundamentoText: {
    fontSize: 9,
    textAlign: "justify",
    lineHeight: 1.4,
    marginTop: 6,
    marginBottom: 8,
  },

  fieldValueMulti: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    paddingBottom: 2,
    paddingHorizontal: 2,
    lineHeight: 1.4,
  },

  importeSubText: {
    fontSize: 8,
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 4,
    marginLeft: "30%",
    color: "#333",
  },

  vigenciaRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-end",
  },
  vigCellColumn: { alignItems: "center", marginRight: 4 },
  vigCellLabel: { fontSize: 7, marginBottom: 2 },
  vigCellBorder: {
    borderWidth: 1,
    borderColor: "#000",
    width: 26,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  vigCellValue: { fontSize: 8 },

  notaWrapper: { marginTop: 8, marginBottom: 4 },
  notaTitle: { fontFamily: FONT_BOLD, fontSize: 8 , letterSpacing: 0.6},
  notaText: { fontSize: 8, textAlign: "justify", lineHeight: 1.4 },

  footerTable: {
    position: "absolute",
    bottom: 22,
    left: 22,
    right: 22,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  footerLeft: {
    width: "60%",
    padding: 6,
  },
  footerRight: { width: "40%", padding: 6 },
  footerLine: { fontSize: 8, marginBottom: 2 },
  footerLabelBold: { fontFamily: FONT_BOLD },
});

function parseDateParts(dateStr: string) {
  if (!dateStr || dateStr.trim() === "" || dateStr.trim() === "—") {
    return { d: "", m: "", y: "" };
  }
  const trimmed = dateStr.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    if (parts.length === 3) {
      return { y: parts[0], m: parts[1], d: parts[2] };
    }
  }
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      return { d: parts[0], m: parts[1], y: parts[2] };
    }
  }
  return { d: trimmed, m: "", y: "" };
}

function tamanoTextoLargo(text: string | null | undefined): { fontSize: number; lineHeight: number } {
  const len = (text ?? "").length;
  if (len <= 150) return { fontSize: 9, lineHeight: 1.4 };
  if (len <= 300) return { fontSize: 8.5, lineHeight: 1.3 };
  if (len <= 450) return { fontSize: 8, lineHeight: 1.25 };
  if (len <= 600) return { fontSize: 7.5, lineHeight: 1.2 };
  return { fontSize: 7, lineHeight: 1.15 };
}

const FUNDAMENTO_TEXTO =
  "Con fundamento en lo dispuesto por los artículos 1, 9, fracción III y 24, fracción XL, de la Ley Orgánica de la Administración Pública para el Estado Libre y Soberano de Morelos, en relación con los numerales 1, 5, fracción XIV, 7, 10, fracción XVII y 23, fracción III, del Reglamento Interior de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal y demás disposiciones jurídicas y administrativas aplicables y una vez realizado el análisis técnico funcional se determina que la Justificación de Prestación de Servicios, relativa a la(s) contratación(es) que se menciona(n), cumple con la metodología y los requisitos establecidos por la Dirección General de Desarrollo Organizacional de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal, por lo que se emite el Dictamen Técnico Funcional de Justificación de Prestación de Servicios:";

export function PlantillaDictamenPrestacionServicios({
  data,
}: {
  data: DictamenPrestacionData;
}) {
  const isHonorarios =
    data.regimenContratacion?.toLowerCase().includes("honorarios") &&
    !data.regimenContratacion?.toLowerCase().includes("asimilado");
  const isAsimilados = data.regimenContratacion
    ?.toLowerCase()
    .includes("asimilado");

  const inD = parseDateParts(data.vigenciaInicio);
  const finD = parseDateParts(data.vigenciaFin);

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>
        <View style={s.pageFrame} fixed />
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <FauxBoldText style={s.headerTitle}>
              DICTAMEN TÉCNICO FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE
              SERVICIOS
            </FauxBoldText>
          </View>
          <View style={s.headerCol3}>
            <View style={s.folioBox}>
              {data.folioActual ? (
                <>
                  <Text style={s.folioText}>Folio de origen: {data.folio}</Text>
                  <Text style={s.folioText}>Folio actual: {data.folioActual}</Text>
                </>
              ) : (
                <Text style={s.folioText}>Folio: {data.folio}</Text>
              )}
            </View>
            <View style={s.pageBox}>
              <Text
                style={s.pageText}
                render={({ pageNumber, totalPages }) =>
                  `Pág.: ${pageNumber} de ${totalPages}`
                }
              />
            </View>
          </View>
        </View>

        <View style={s.fechaRow}>
          <FauxBoldText style={s.fechaText}>Fecha : </FauxBoldText>
          <FauxBoldText style={s.fechaText}>{data.fecha}</FauxBoldText>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabelBox}>Secretaría/Dependencia:</Text>
          <Text style={s.fieldValue}>{toTitleCaseES(data.secretariaDependencia)}</Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabelBox}>Unidad Responsable del Gasto:</Text>
          <Text style={s.fieldValue}>{toTitleCaseES(data.unidadResponsableGasto)}</Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabelBox}>Unidad Administrativa:</Text>
          <Text style={s.fieldValue}>{toTitleCaseES(data.unidadAdministrativa)}</Text>
        </View>

        <View style={s.regimenRow}>
          <Text style={s.regimenLabel}>Régimen de Contratación:</Text>
          <View style={s.regimenBoxes}>
            <Text style={s.checkLabel}>Honorarios</Text>
            <View style={s.checkboxRect}>
              {isHonorarios && <Text style={s.checkText}>X</Text>}
            </View>
            <Text style={{ ...s.checkLabel, marginLeft: 10 }}>
              Honorarios Asimilados a Salarios
            </Text>
            <View style={s.checkboxRect}>
              {isAsimilados && <Text style={s.checkText}>X</Text>}
            </View>
          </View>
        </View>

        <Text style={s.fundamentoText}>
          {FUNDAMENTO_TEXTO}
        </Text>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Tipo de servicios:</Text>
          <Text style={s.fieldValue}>{data.tipoServicios}</Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>
            Clave y nombre del programa{"\n"}o proyecto:
          </Text>
          <Text style={s.fieldValueMulti}>{data.claveNombrePrograma}</Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Objeto de la contratación:</Text>
          <Text style={[s.fieldValueMulti, tamanoTextoLargo(data.objetoContratacion)]}>
            {data.objetoContratacion}
          </Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Importe bruto:</Text>
          <Text style={s.fieldValue}>
            {data.importeBruto}
            {data.tipoPagoLabel ? ` (${data.tipoPagoLabel})` : ""}
          </Text>
        </View>
        <Text style={s.importeSubText}>
          (El pago se realizará como lo determine la Unidad Administrativa sin
          exceder el monto total autorizado)
        </Text>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Justificación:</Text>
          <Text style={s.fieldValue}>{data.justificacion}</Text>
        </View>

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Número de Prestadores de{"\n"}Servicios:</Text>
          <Text style={s.fieldValue}>{data.numeroPrestadores}</Text>
        </View>

        <View style={s.vigenciaRow} wrap={false}>
          <Text style={s.fieldLabel}>Vigencia del Dictamen:</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Día</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{inD.d}</Text>
              </View>
            </View>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Mes</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{inD.m}</Text>
              </View>
            </View>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Año</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{inD.y}</Text>
              </View>
            </View>
            <Text style={{ marginHorizontal: 8, paddingBottom: 2, fontSize: 9 }}>
              al
            </Text>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Día</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{finD.d}</Text>
              </View>
            </View>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Mes</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{finD.m}</Text>
              </View>
            </View>
            <View style={s.vigCellColumn}>
              <Text style={s.vigCellLabel}>Año</Text>
              <View style={s.vigCellBorder}>
                <Text style={s.vigCellValue}>{finD.y}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.notaWrapper} wrap={false}>
          <Text style={s.notaText}>
            <Text style={s.notaTitle}>NOTA: </Text>
            {data.notaDictamen ?? NOTA_DICTAMEN_DEFAULT}
          </Text>
        </View>

        <View style={s.footerTable} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerLine}>
              <Text style={s.footerLabelBold}>Formato:</Text>{" "}
              {data.formatoDoc ||
                "Dictamen Técnico Funcional de Justificación de Prestación de Servicios"}
            </Text>
            <Text style={s.footerLine}>
              <Text style={s.footerLabelBold}>Clave:</Text>{" "}
              {data.claveDoc || "DGDO-DDPP-PR01-FO11"}
            </Text>
            <Text style={s.footerLine}>
              <Text style={s.footerLabelBold}>Anexo:</Text>{" "}
              {data.anexoDoc || "14"}
            </Text>
          </View>
          <View style={s.footerRight}>
            <Text style={s.footerLine}>
              <Text style={s.footerLabelBold}>Referencia:</Text>{" "}
              {data.referenciaDoc || "DGDO-DDPP-PR01"}
            </Text>
            <Text style={s.footerLine}>
              <Text style={s.footerLabelBold}>Revisión:</Text>{" "}
              {data.revisionDoc || "2"}
            </Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
