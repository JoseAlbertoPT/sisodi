import { Text } from "@react-pdf/renderer";
import React from "react";

// QuetzalliSans solo tiene registrado el peso Thin (ver comentario en cada
// plantilla) — react-pdf no puede negritar sintéticamente una fuente, así
// que `fontFamily: FONT_BOLD` no produce texto en negritas de verdad.
//
// Se probó simular la negrita superponiendo el mismo texto dos veces con
// `position: "absolute"`. Verificado con renders reales (pdftoppm): como
// hijo único de un View "column" (el default), el texto absoluto no se
// superpone y se duplica en el flujo normal; forzando el contenedor a
// flexDirection "row" se corrige ESE caso, pero entonces cualquier título
// que necesite hacer wrap a varias líneas se rompe por completo (el texto
// se corta palabra por palabra y se superpone en vertical) porque un hijo
// de un contenedor "row" no hereda el ancho del padre para calcular el
// wrap. No hay una combinación de estilos que funcione para textos cortos
// Y largos a la vez, así que se descartó por completo.
//
// En su lugar se usa Helvetica-Bold (fuente estándar de react-pdf, siempre
// disponible, negrita real) solo para este texto — el resto del documento
// sigue en QuetzalliSans. Es la única opción confiable sin un archivo de
// fuente QuetzalliSans en negritas real.
export function FauxBoldText({
  style,
  children,
}: {
  style?: any;
  children: React.ReactNode;
}) {
  return <Text style={[style, { fontFamily: "Helvetica-Bold" }]}>{children}</Text>;
}
