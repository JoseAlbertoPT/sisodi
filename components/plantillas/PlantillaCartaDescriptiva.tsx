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
import { resolveQuetzalliSansPath, registerPdfNoHyphenation } from "@/lib/pdf-fonts";

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
// Solo existe el peso Thin de QuetzalliSans por ahora — se usa la misma
// familia para "bold" (react-pdf no puede negritar sintéticamente); en
// cuanto se agregue el peso Bold real, registrarlo aparte y usarlo aquí.
const FONT_REGULAR = quetzalliPath ? "QuetzalliSans" : "Helvetica";
const FONT_BOLD = quetzalliPath ? "QuetzalliSans" : "Helvetica-Bold";

export interface CartaDescriptivaData {
  objetoContratacion: string;
  propositoServicios: string;
  actividades: string[];
  responsabilidades: string[];
  perfil: {
    escolaridadMinima: string[];
    competenciasAdministrativas: string[];
    competenciasTecnicas: string[];
    competenciasSociales: string[];
    valores: string[];
    areasExperiencia: string[];
  };
  clave?: string;
}

const LOGO_FINANZAS = fs.readFileSync(path.join(process.cwd(), "public/logo-20finanzas.png"));
const MARCA_MORELOS = fs.readFileSync(path.join(process.cwd(), "public/LOGO_MORELOS_V1.png"));

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    color: "#000",
    position: "relative",
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
  pageFrame: {
    position: "absolute",
    top: 18,
    left: 22,
    right: 22,
    bottom: 18,
    borderWidth: 1,
    borderColor: "#000",
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
    marginBottom: 36,
    borderWidth: 1,
    borderColor: "#000",
  },
  headerCol1: {
    width: "25%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  logo: { width: 110, height: "auto" },
  headerCol2: {
    width: "50%",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  headerCol3: { width: "25%", flexDirection: "column" },
  headerTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  headerSubtitle: {
    fontFamily: FONT_REGULAR,
    fontSize: 8,
    textAlign: "center",
    marginTop: 3,
  },
  pageBox: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingHorizontal: 4,
    paddingTop: 10,
    justifyContent: "flex-start",
  },
  pageBoxSecondary: { flex: 1, paddingHorizontal: 4, paddingTop: 4, justifyContent: "flex-start" },
  claveText: { fontSize: 8, textAlign: "center" },

  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 },
  fechaLabel: { fontSize: 8, fontFamily: FONT_BOLD , letterSpacing: 0.6},
  fechaValue: { fontSize: 8, fontFamily: FONT_REGULAR },
  centeredTitle: { fontFamily: FONT_BOLD, fontSize: 10, textAlign: "center", marginBottom: 16 , letterSpacing: 0.6},
  notaText: { fontSize: 8, textAlign: "justify", lineHeight: 1.4, marginBottom: 14 },
  sectionTitle: { fontFamily: FONT_BOLD, fontSize: 10, marginBottom: 8, marginTop: 10 , letterSpacing: 0.6},
  bold: { fontFamily: FONT_BOLD , letterSpacing: 0.6},

  paragraph: { textAlign: "justify", lineHeight: 1.5, marginBottom: 8, marginTop: 4 },

  listItemContainer: { flexDirection: "row", marginBottom: 6, paddingLeft: 10, marginTop: 2 },
  listNum: { width: 15, fontFamily: FONT_BOLD },
  listTextWrap: { flex: 1, textAlign: "justify", lineHeight: 1.5 },

  bulletItemContainer: { flexDirection: "row", marginBottom: 1, paddingLeft: 20 },
  bulletSign: { width: 15, fontFamily: FONT_REGULAR },
});

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fechaMesAnioActual(): string {
  const d = new Date();
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function renderNumberedList(items: string[] | undefined, keyPrefix: string) {
  if (!items || items.length === 0) return null;
  return (
    <>
      <View wrap={false}>
        <View key={`${keyPrefix}-0`} style={s.listItemContainer}>
          <Text style={s.listNum}>1.</Text>
          <Text style={s.listTextWrap}>{items[0]}</Text>
        </View>
      </View>
      {items.slice(1).map((item, index) => (
        <View key={`${keyPrefix}-${index + 1}`} style={s.listItemContainer} wrap={false}>
          <Text style={s.listNum}>{index + 2}.</Text>
          <Text style={s.listTextWrap}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function PlantillaCartaDescriptiva({ data }: { data: CartaDescriptivaData }) {
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
            <Text style={s.headerTitle}>CARTA DESCRIPTIVA DE PRESTACIÓN DE SERVICIOS</Text>
            <Text style={s.headerSubtitle}>SECRETARIAS , DEPENDENCIAS Y ORGANISMOS AUXILIARES</Text>
          </View>
          <View style={s.headerCol3}>
            <View style={s.pageBox}>
              <Text style={s.claveText}>{data.clave || "Clave"}</Text>
            </View>
            <View style={s.pageBoxSecondary}>
              <Text style={s.claveText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>

        <View style={s.fechaRow}>
          <Text style={s.fechaLabel}>Fecha : </Text>
          <Text style={s.fechaValue}>{fechaMesAnioActual()}</Text>
        </View>

        <Text style={s.notaText}>
          <Text style={s.bold}>Nota: </Text>
          La presente carta descriptiva de prestación de servicios es una referencia para la contratación de personas y deberá atender a criterios no discriminatorios.
        </Text>

        <Text style={s.centeredTitle}>1. CARTA DESCRIPTIVA</Text>

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.1.    OBJETO DE LA CONTRATACIÓN:</Text>
          <Text style={s.paragraph}>{data.objetoContratacion}</Text>
        </View>

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.2.    PROPÓSITO DE SERVICIOS A CONTRATAR:</Text>
          <Text style={s.paragraph}>{data.propositoServicios}</Text>
        </View>

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.3.    ACTIVIDADES DEL PRESTADOR DE SERVICIOS:</Text>
        </View>
        {renderNumberedList(data.actividades, "act")}

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.4.    RESPONSABILIDADES DEL PRESTADOR DE SERVICIOS:</Text>
        </View>
        {renderNumberedList(data.responsabilidades, "resp")}

        <View wrap={false}>
          <Text style={{ ...s.centeredTitle, marginTop: 14 }}>2. PERFIL DEL PRESTADOR DE SERVICIOS</Text>

          <Text style={{ ...s.bold, marginBottom: 4 }}>2.1.    ESCOLARIDAD DEL PRESTADOR DE SERVICIOS:</Text>
        </View>
        {renderNumberedList(data.perfil?.escolaridadMinima, "esc")}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginTop: 6, marginBottom: 4 }}>2.2.    COMPETENCIAS DEL PRESTADOR DE SERVICIOS:</Text>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 2 }}>2.2.1.  Competencias Administrativas:</Text>
        </View>
        {renderNumberedList(data.perfil?.competenciasAdministrativas, "ca")}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 5, marginBottom: 2 }}>2.2.2.  Competencias Técnicas:</Text>
        </View>
        {renderNumberedList(data.perfil?.competenciasTecnicas, "ct")}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 5, marginBottom: 2 }}>2.2.3.  Competencias Sociales:</Text>
        </View>
        {renderNumberedList(data.perfil?.competenciasSociales, "cs")}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 5, marginBottom: 2 }}>2.2.4.  Valores:</Text>
        </View>
        {renderNumberedList(data.perfil?.valores, "val")}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginTop: 6, marginBottom: 2 }}>2.3.    ÁREAS DE EXPERIENCIA DEL PRESTADOR DE SERVICIOS:</Text>
        </View>
        {renderNumberedList(data.perfil?.areasExperiencia, "ae")}

      </Page>
    </Document>
  );
}
