-- Renombra los 3 estados del flujo que corresponden al Filtro 2 / Verificador.
-- No toca los estados de UEFA ("En Validacion Justificaciones", "Observado por Validacion").
UPDATE estado SET nombre = 'Pendiente Firma Verificacion' WHERE nombre = 'Pendiente Firma Validacion';
UPDATE estado SET nombre = 'En Verificacion Final' WHERE nombre = 'En Validacion Final';
UPDATE estado SET nombre = 'Observado por Verificacion Final' WHERE nombre = 'Observado por Validacion Final';
UPDATE estado SET nombre = 'Observada por Verificacion Final' WHERE nombre = 'Observada por Validacion Final';
