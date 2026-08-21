-- Observación 6: algunos nombres de secretaría muestran errores de acentuación.
-- Causa raíz: el importador de Excel (lib/importar-catalogo-excel.ts) guardaba en
-- secretaria_txt_snapshot el texto crudo de la columna del Excel aun cuando ya
-- existía un nombre canónico (bien acentuado) resuelto para la columna
-- `secretaria`. secretaria_txt_snapshot es el valor que se muestra en pantalla,
-- por lo que cualquier error de acentuación del Excel se propagaba a la UI.
-- Esa causa ya se corrigió en el código de importación; esta migración repara
-- los registros ya importados.
--
-- Solo se sincroniza secretaria_txt_snapshot <- secretaria cuando ambos textos,
-- al normalizarlos (mayúsculas y sin acentos), representan la misma secretaría.
-- Esto evita tocar filas donde la diferencia no es un problema de acentos sino
-- un nombre realmente distinto (p. ej. un cambio histórico de nombre).

UPDATE solicitud
SET secretaria_txt_snapshot = secretaria
WHERE secretaria IS NOT NULL
  AND secretaria_txt_snapshot IS NOT NULL
  AND secretaria_txt_snapshot <> secretaria
  AND translate(upper(secretaria_txt_snapshot), 'ÁÉÍÓÚÑÜ', 'AEIOUNU')
    = translate(upper(secretaria), 'ÁÉÍÓÚÑÜ', 'AEIOUNU');

UPDATE catalogo_justificacion
SET secretaria_txt_snapshot = secretaria
WHERE secretaria IS NOT NULL
  AND secretaria_txt_snapshot IS NOT NULL
  AND secretaria_txt_snapshot <> secretaria
  AND translate(upper(secretaria_txt_snapshot), 'ÁÉÍÓÚÑÜ', 'AEIOUNU')
    = translate(upper(secretaria), 'ÁÉÍÓÚÑÜ', 'AEIOUNU');
