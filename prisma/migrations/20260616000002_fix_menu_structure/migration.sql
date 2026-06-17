-- Fix parent_id for all known menu items
UPDATE menu SET parent_id = NULL WHERE id IN (1, 2, 6, 10);
UPDATE menu SET parent_id = 2    WHERE id IN (3, 4, 5);
UPDATE menu SET parent_id = 6    WHERE id IN (7, 8, 9, 14);

-- Rename section names
UPDATE menu SET nombre = 'GESTIÓN DGDO'   WHERE id = 6;
UPDATE menu SET nombre = 'JUSTIFICACIONES' WHERE id = 2;

-- Deactivate Progreso Firmado
UPDATE menu SET activo = false WHERE id = 14;

-- Ensure correct keys
UPDATE menu SET key = 'dashboard'       WHERE id = 1;
UPDATE menu SET key = NULL              WHERE id = 2;
UPDATE menu SET key = 'nueva-solicitud' WHERE id = 3;
UPDATE menu SET key = 'mis-solicitudes' WHERE id = 4;
UPDATE menu SET key = 'validacion-uefa' WHERE id = 5;
UPDATE menu SET key = NULL              WHERE id = 6;
UPDATE menu SET key = 'bandeja-filtro1' WHERE id = 7;
UPDATE menu SET key = 'bandeja-filtro2' WHERE id = 8;
UPDATE menu SET key = 'bandeja-filtro3' WHERE id = 9;
UPDATE menu SET key = 'dictamenes'      WHERE id = 10;
UPDATE menu SET key = 'calendario'      WHERE id = 11;
UPDATE menu SET key = 'usuarios'        WHERE id = 12;
UPDATE menu SET key = 'configuracion'   WHERE id = 13;

-- Create CONFIGURACION section and move Calendario/Usuarios/Catalogo under it
DO $$
DECLARE
  config_id INT;
BEGIN
  SELECT id INTO config_id
  FROM menu
  WHERE nombre ILIKE '%CONFIGURACI%' AND parent_id IS NULL
  LIMIT 1;

  IF config_id IS NULL THEN
    INSERT INTO menu (nombre, key, icono, ruta, orden, parent_id, activo)
    VALUES ('CONFIGURACIÓN', NULL, NULL, NULL, 3, NULL, true)
    RETURNING id INTO config_id;
  ELSE
    UPDATE menu SET nombre = 'CONFIGURACIÓN', activo = true, orden = 3
    WHERE id = config_id;
  END IF;

  UPDATE menu SET parent_id = config_id, activo = true, orden = 1 WHERE id = 11;
  UPDATE menu SET parent_id = config_id, activo = true, orden = 2 WHERE id = 12;
  UPDATE menu SET parent_id = config_id, activo = true, orden = 3 WHERE id = 13;
END $$;

-- Fix section orders
UPDATE menu SET orden = 0 WHERE id = 1;
UPDATE menu SET orden = 1 WHERE id = 2;
UPDATE menu SET orden = 2 WHERE id = 6;
