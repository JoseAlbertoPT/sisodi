-- Fix orden de menús dentro de cada grupo
-- JUSTIFICACIONES: Tablero(1), Catálogo(2), Nueva solicitud(3), Mis solicitudes(4), Validación UEFA(5)
UPDATE menu SET orden = 1 WHERE key = 'dashboard';
UPDATE menu SET orden = 2 WHERE key = 'catalogo-justificaciones';
UPDATE menu SET orden = 3 WHERE key = 'nueva-solicitud';
UPDATE menu SET orden = 4 WHERE key = 'mis-solicitudes';
UPDATE menu SET orden = 5 WHERE key = 'validacion-uefa';

-- GESTIÓN DGDO: Validacion(1), Revision(2), Emision(3), Dictámenes(4)
UPDATE menu SET orden = 1 WHERE key = 'bandeja-filtro2';
UPDATE menu SET orden = 2 WHERE key = 'bandeja-filtro1';
UPDATE menu SET orden = 3 WHERE key = 'bandeja-filtro3';
UPDATE menu SET orden = 4 WHERE key = 'dictamenes';

-- CONFIGURACIÓN: Calendario(1), Usuarios(2), Entidades(3)
UPDATE menu SET orden = 1 WHERE key = 'calendario';
UPDATE menu SET orden = 2 WHERE key = 'usuarios';
UPDATE menu SET orden = 3 WHERE key = 'entidades';
