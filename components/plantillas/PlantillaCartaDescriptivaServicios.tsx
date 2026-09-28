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
import { FauxBoldText } from "@/components/plantillas/faux-bold-text";

registerPdfNoHyphenation();

Font.register({
  family: "NotoSymbols",
  src: path.join(process.cwd(), "public/fonts/NotoSansSymbols2-Regular.ttf"),
});

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
const FONT_BOLD = quetzalliPath ? "QuetzalliSans" : "Helvetica-Bold";

Font.registerHyphenationCallback((word) => [word]);

export interface CartaDescriptivaData {
  clave?: string;
  fecha: string;
  objetoContratacion: string;
  actividades: string[];
  responsabilidades: string[];
  escolaridad: string[];
  competenciasAdministrativas: string[];
  competenciasTecnicas: string[];
  competenciasSociales: string[];
  valores: string[];
  areasExperiencia: string[];
  /** Reutilización desde Catálogo: quien firma (UEFA) — se imprime al final de
   *  la Carta, con el QR de validación al pie de cada página. */
  firmaNombre?: string;
  firmaCargo?: string;
  firmaUrlValidacion?: string;
  firmaQrPng?: Buffer;
}

const LOGO_FINANZAS = fs.readFileSync(
  path.join(process.cwd(), "public/logo-20finanzas.png"),
);
const MARCA_MORELOS = fs.readFileSync(
  path.join(process.cwd(), "public/LOGO_MORELOS_V1.png"),
);
const BANNER_COMPLETO = fs.readFileSync(
  path.join(process.cwd(), "public/banner-completo.png"),
);

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: FONT_REGULAR,
    fontSize: 10,
    color: "#000",
    position: "relative",
  },
  pageFrame: {
    position: "absolute",
    top: 18,
    left: 22,
    right: 22,
    bottom: 22,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#000",
  },
  headerCol1: {
    width: "20%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  logo: { width: 90, height: "auto" },
  headerCol2: {
    width: "57%",
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  headerTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.6,
  },
  headerCol3: {
    width: "23%",
    flexDirection: "column",
  },
  claveBox: {
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 30,
    justifyContent: "center",
  },
  claveText: { fontSize: 8, textAlign: "left" },
  pageBox: { padding: 4, justifyContent: "center", minHeight: 16 },
  pageText: { fontSize: 8, textAlign: "left" },

  fechaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  fechaText: { fontSize: 10 },

  notaText: {
    fontSize: 10,
    textAlign: "justify",
    lineHeight: 1.4,
    marginBottom: 14,
  },
  notaLabel: { fontFamily: FONT_BOLD , letterSpacing: 0.6},

  sectionTitleWrap: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.6,
  },

  subSectionRow: {
    flexDirection: "row",
    marginBottom: 4,
    marginTop: 10,
  },
  subSectionNumber: {
    width: 32,
    fontFamily: FONT_BOLD,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  subSectionTitle: {
    flex: 1,
    fontFamily: FONT_BOLD,
    fontSize: 10,
    letterSpacing: 0.6,
  },

  paragraph: {
    fontSize: 10,
    textAlign: "justify",
    lineHeight: 1.4,
    marginLeft: 32,
    marginBottom: 8,
  },

  romanItem: {
    marginLeft: 32,
    marginBottom: 6,
  },
  romanText: {
    fontSize: 10,
    textAlign: "justify",
    lineHeight: 1.4,
  },

  subSubTitle: {
    fontSize: 10,
    fontFamily: FONT_BOLD,
    marginLeft: 48,
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.6,
  },
  subSubNumber: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    letterSpacing: 0.6,
  },

  bulletRow: {
    flexDirection: "row",
    marginLeft: 72,
    marginBottom: 3,
  },
  bulletChar: {
    width: 14,
    fontSize: 7,
    fontFamily: "NotoSymbols",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.35,
  },
});

function BulletItem({ text }: { text: string }) {
  return (
    <View style={s.bulletRow} wrap={false}>
      <Text style={s.bulletChar}>{"\u2756"}</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function RomanItem({ text }: { text: string }) {
  return (
    <View style={s.romanItem} wrap={false}>
      <Text style={s.romanText}>{text}</Text>
    </View>
  );
}

// Listas de viñetas hasta este tamaño se mantienen completas (título + todas
// las viñetas): si no caben en lo que resta de la hoja, la sección entera
// pasa a la siguiente en vez de dejar una o dos viñetas sueltas en otra hoja.
const MAX_ITEMS_BLOQUE = 12;

/**
 * Reparte los elementos de una lista para evitar huérfanos al paginar:
 * - lista corta de viñetas → un solo bloque que no se parte;
 * - lista larga → título + primer elemento juntos, los intermedios sueltos y
 *   los dos últimos juntos, para que nunca quede un solo elemento en una hoja.
 */
function ListaSinHuerfanos({
  encabezado,
  items,
  render,
  bloqueCompleto,
  minPresenceAhead,
}: {
  encabezado: React.ReactNode;
  items: string[];
  render: (text: string, key: number) => React.ReactNode;
  bloqueCompleto: boolean;
  minPresenceAhead: number;
}) {
  if (bloqueCompleto || items.length <= 2) {
    return (
      <View wrap={false}>
        {encabezado}
        {items.map((it, i) => render(it, i))}
      </View>
    );
  }
  const primero = items[0]!;
  const medio = items.slice(1, -2);
  const ultimos = items.slice(-2);
  return (
    <>
      <View wrap={false} minPresenceAhead={minPresenceAhead}>
        {encabezado}
        {render(primero, 0)}
      </View>
      {medio.map((it, i) => render(it, i + 1))}
      <View wrap={false}>
        {ultimos.map((it, i) => render(it, items.length - 2 + i))}
      </View>
    </>
  );
}

function SubSection({
  number,
  title,
  items,
  variant,
}: {
  number: string;
  title: string;
  items: string[];
  variant: "roman" | "bullet";
}) {
  if (items.length === 0) return null;

  return (
    <ListaSinHuerfanos
      encabezado={
        <View style={s.subSectionRow}>
          <FauxBoldText style={s.subSectionNumber}>{number}</FauxBoldText>
          <FauxBoldText style={s.subSectionTitle}>{title}</FauxBoldText>
        </View>
      }
      items={items}
      render={(text, key) =>
        variant === "roman" ? <RomanItem key={key} text={text} /> : <BulletItem key={key} text={text} />
      }
      bloqueCompleto={variant === "bullet" && items.length <= MAX_ITEMS_BLOQUE}
      minPresenceAhead={40}
    />
  );
}

function SubSubBullets({
  number,
  title,
  items,
}: {
  number: string;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <ListaSinHuerfanos
      encabezado={
        <FauxBoldText style={s.subSubTitle}>
          <Text style={s.subSubNumber}>{number} </Text>
          {title}
        </FauxBoldText>
      }
      items={items}
      render={(text, key) => <BulletItem key={key} text={text} />}
      bloqueCompleto={items.length <= MAX_ITEMS_BLOQUE}
      minPresenceAhead={30}
    />
  );
}

export function PlantillaCartaDescriptivaServicios({
  data,
}: {
  data: CartaDescriptivaData;
}) {
  const clave = data.clave ?? "";
  const tieneFirma = !!data.firmaNombre;

  return (
    <Document>
      <Page size="LETTER" style={tieneFirma ? [s.page, { paddingBottom: 94 }] : s.page} wrap>
        <View style={tieneFirma ? [s.pageFrame, { bottom: 80 }] : s.pageFrame} fixed />
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <FauxBoldText style={s.headerTitle}>
              CARTA DESCRIPTIVA DE PRESTACIÓN DE SERVICIOS
            </FauxBoldText>
            <FauxBoldText style={s.headerTitle}>
              SECRETARÍAS, DEPENDENCIAS Y ORGANISMOS AUXILIARES
            </FauxBoldText>
          </View>
          <View style={s.headerCol3}>
            <View style={s.claveBox}>
              <Text style={s.claveText}>Clave: {clave}</Text>
            </View>
            <View style={s.pageBox}>
              <Text
                style={s.pageText}
                render={({ pageNumber, totalPages }) =>
                  `Pág. ${pageNumber} de ${totalPages}`
                }
              />
            </View>
          </View>
        </View>

        <View style={s.fechaRow}>
          <FauxBoldText style={s.fechaText}>Fecha : </FauxBoldText>
          <FauxBoldText style={s.fechaText}>{data.fecha}</FauxBoldText>
        </View>

        <Text style={s.notaText}>
          <Text style={s.notaLabel}>Nota: </Text>
          La presente carta descriptiva de Prestación de Servicios es una
          referencia para la contratación de personas y deberá atender a
          criterios no discriminatorios.
        </Text>

        <View style={s.sectionTitleWrap} wrap={false} minPresenceAhead={80}>
          <FauxBoldText style={s.sectionTitle}>1. CARTA DESCRIPTIVA</FauxBoldText>
        </View>

        {data.objetoContratacion.trim() !== "" && (
          <View wrap={false} minPresenceAhead={60}>
            <View style={s.subSectionRow}>
              <FauxBoldText style={s.subSectionNumber}>1.1</FauxBoldText>
              <FauxBoldText style={s.subSectionTitle}>OBJETO DE LA CONTRATACIÓN:</FauxBoldText>
            </View>
            <Text style={s.paragraph}>{data.objetoContratacion}</Text>
          </View>
        )}

        <SubSection
          number="1.2"
          title="ACTIVIDADES DEL PRESTADOR DE SERVICIOS:"
          items={data.actividades}
          variant="roman"
        />

        <SubSection
          number="1.3"
          title="RESPONSABILIDADES DEL PRESTADOR DE SERVICIOS:"
          items={data.responsabilidades}
          variant="roman"
        />

        <View style={s.sectionTitleWrap} wrap={false} minPresenceAhead={80}>
          <FauxBoldText style={s.sectionTitle}>
            2. PERFIL DEL PRESTADOR DE SERVICIOS:
          </FauxBoldText>
        </View>

        <SubSection
          number="2.1"
          title="ESCOLARIDAD DEL PRESTADOR DE SERVICIOS:"
          items={data.escolaridad}
          variant="bullet"
        />

        {(data.competenciasAdministrativas.length > 0 ||
          data.competenciasTecnicas.length > 0 ||
          data.competenciasSociales.length > 0 ||
          data.valores.length > 0) && (
          <View style={s.subSectionRow} wrap={false} minPresenceAhead={50}>
            <FauxBoldText style={s.subSectionNumber}>2.2</FauxBoldText>
            <FauxBoldText style={s.subSectionTitle}>
              COMPETENCIAS DEL PRESTADOR DE SERVICIOS:
            </FauxBoldText>
          </View>
        )}

        <SubSubBullets
          number="2.2.1"
          title="Competencias Administrativas:"
          items={data.competenciasAdministrativas}
        />
        <SubSubBullets
          number="2.2.2"
          title="Competencias Técnicas:"
          items={data.competenciasTecnicas}
        />
        <SubSubBullets
          number="2.2.3"
          title="Competencias Sociales:"
          items={data.competenciasSociales}
        />
        <SubSubBullets
          number="2.2.4"
          title="Valores:"
          items={data.valores}
        />

        <SubSection
          number="2.3"
          title="ÁREAS DE EXPERIENCIA DEL PRESTADOR DE SERVICIOS:"
          items={data.areasExperiencia}
          variant="bullet"
        />

        {tieneFirma ? (
          <View wrap={false} style={{ marginTop: 12, alignItems: "center" }}>
            <FauxBoldText style={{ fontFamily: FONT_BOLD, fontSize: 8, textAlign: "center", marginBottom: 2, letterSpacing: 0.6 }}>
              ATENTAMENTE
            </FauxBoldText>
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 7, textAlign: "center", marginBottom: 1, color: "#B00020", letterSpacing: 0.6 }}>
              DOCUMENTO FIRMADO ELECTRÓNICAMENTE
            </Text>
            <Text style={{ fontSize: 7, textAlign: "center", lineHeight: 1.25, maxWidth: "88%", marginBottom: 3 }}>
              a través de un certificado reconocido legalmente y tiene, en relación a la información firmada, un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
            </Text>
            <FauxBoldText style={{ fontFamily: FONT_BOLD, fontSize: 8, textAlign: "center", letterSpacing: 0.6 }}>
              {data.firmaNombre}
            </FauxBoldText>
            {data.firmaCargo ? (
              <FauxBoldText style={{ fontFamily: FONT_BOLD, fontSize: 7, textAlign: "center", letterSpacing: 0.6 }}>{data.firmaCargo}</FauxBoldText>
            ) : null}
          </View>
        ) : null}

        {tieneFirma ? (
          <View style={{ position: "absolute", bottom: 8, left: 22, right: 22 }} fixed>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", width: "100%", marginBottom: 0 }}>
              {data.firmaUrlValidacion ? (
                <Text style={{ fontSize: 6, color: "#000000", marginRight: 6, marginTop: 10 }}>
                  {data.firmaUrlValidacion}
                </Text>
              ) : null}
              {data.firmaQrPng ? (
                <Image src={data.firmaQrPng} style={{ width: 54, height: 54, marginTop: -12 }} />
              ) : null}
            </View>
            <Image src={BANNER_COMPLETO} style={{ width: "100%", height: 16 }} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
