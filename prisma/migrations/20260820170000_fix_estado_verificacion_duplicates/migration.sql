-- Completa lo que 20260819170000_rename_estado_validacion_final_verificacion no
-- pudo terminar. En entornos donde el seed de estados ya se había corrido con
-- los nombres nuevos ("En Verificacion Final", "Observado por Verificacion
-- Final"), esa migración fallaba con "llave duplicada" al intentar renombrar
-- las filas viejas ("En Validacion Final", "Observado por Validacion Final")
-- a un nombre que ya existía en otra fila.
--
-- Esta migración reasigna las referencias (historial_solicitud, solicitud) de
-- la fila vieja a la fila nueva y elimina la fila vieja, ya sin uso. Es un
-- no-op seguro si no existe ese duplicado (p. ej. porque el rename original sí
-- se pudo aplicar en su momento).

DO $$
DECLARE
  old_id INT;
  new_id INT;
BEGIN
  SELECT id INTO old_id FROM estado WHERE nombre = 'En Validacion Final';
  SELECT id INTO new_id FROM estado WHERE nombre = 'En Verificacion Final';
  IF old_id IS NOT NULL AND new_id IS NOT NULL AND old_id <> new_id THEN
    UPDATE historial_solicitud SET estado_anterior_id = new_id WHERE estado_anterior_id = old_id;
    UPDATE historial_solicitud SET estado_nuevo_id    = new_id WHERE estado_nuevo_id    = old_id;
    UPDATE solicitud SET estado_id = new_id WHERE estado_id = old_id;
    DELETE FROM estado WHERE id = old_id;
  END IF;

  SELECT id INTO old_id FROM estado WHERE nombre = 'Observado por Validacion Final';
  SELECT id INTO new_id FROM estado WHERE nombre = 'Observado por Verificacion Final';
  IF old_id IS NOT NULL AND new_id IS NOT NULL AND old_id <> new_id THEN
    UPDATE historial_solicitud SET estado_anterior_id = new_id WHERE estado_anterior_id = old_id;
    UPDATE historial_solicitud SET estado_nuevo_id    = new_id WHERE estado_nuevo_id    = old_id;
    UPDATE solicitud SET estado_id = new_id WHERE estado_id = old_id;
    DELETE FROM estado WHERE id = old_id;
  END IF;
END $$;
