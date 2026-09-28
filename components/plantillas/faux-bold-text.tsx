import { Text } from "@react-pdf/renderer";
import React from "react";

// Texto de títulos/subtítulos de los PDF. La negrita la da `fontFamily:
// FONT_BOLD` del estilo que recibe (QuetzalliSans-Bold, ver
// lib/pdf-fonts.ts:resolveQuetzalliSansBoldPath). Antes de existir ese peso,
// este componente simulaba la negrita separando letras y agrandando el texto;
// ya no hace falta.
export function FauxBoldText({
  style,
  children,
}: {
  style?: any;
  children: React.ReactNode;
}) {
  return (
    <Text
      style={[
        style,
        {
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
