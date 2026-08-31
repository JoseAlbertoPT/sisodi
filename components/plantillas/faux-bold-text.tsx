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
// Antes esto se resolvía cambiando a Helvetica-Bold (negrita real, pero una
// tipografía completamente distinta a QuetzalliSans — se notaba a simple
// vista que era otra fuente). Se prefirió mantener QuetzalliSans en todo el
// documento y diferenciar el texto "bold" solo con separación de letras y un
// tamaño ligeramente mayor — resalta sin mezclar tipografías.
export function FauxBoldText({
  style,
  children,
}: {
  style?: any;
  children: React.ReactNode;
}) {
  const merged = Object.assign({}, ...(Array.isArray(style) ? style : [style ?? {}]));
  return (
    <Text
      style={[
        style,
        {
          letterSpacing: (merged.letterSpacing ?? 0) + 0.5,
          ...(merged.fontSize ? { fontSize: merged.fontSize + 0.5 } : {}),
          // Negro puro explícito: si este texto queda dentro de un
          // contenedor con un color heredado más claro, sin esto se vería
          // gris en vez de negro. Ningún uso actual de FauxBoldText pide un
          // color propio (rojo, gris, etc.), así que forzarlo es seguro.
          color: "#000",
        },
      ]}
    >
      {children}
    </Text>
  );
}
