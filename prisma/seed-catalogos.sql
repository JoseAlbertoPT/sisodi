-- ==========================================================================
-- SEED: Catálogo Administración Pública Centralizada
-- 16 Secretarías raíz + dependencias hijas
-- ==========================================================================

-- 1. Despacho del Gobernador
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Despacho del Gobernador', 1, 'secretaria', NULL),
  ('a0000001-0000-0000-0000-000000000101', 'Coordinación de Asesores', 1, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000102', 'Coordinación de Comunicación Social', 2, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000103', 'Coordinación de Imagen', 3, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000104', 'Coordinación de Relaciones Públicas', 4, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000105', 'Secretaría Particular', 5, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000106', 'Secretaría Privada', 6, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000107', 'Ayudantía', 7, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000108', 'Representación del Gobierno del Estado en la Ciudad de México', 8, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000109', 'Coordinación General de Programas Federales', 9, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000110', 'Coordinación General de Desarrollo Regional', 10, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000111', 'Comisionado de Búsqueda de Personas', 11, NULL, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000112', 'Sistema de Radio y Televisión', 12, NULL, 'a0000001-0000-0000-0000-000000000001');

-- 2. Secretaría de Gobierno
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000002-0000-0000-0000-000000000001', 'Secretaría de Gobierno', 2, 'secretaria', NULL),
  ('a0000002-0000-0000-0000-000000000101', 'Subsecretaría de Gobierno', 1, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000102', 'Subsecretaría de Asuntos Jurídicos', 2, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000103', 'Dirección General de Gobierno', 3, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000104', 'Dirección General de Asuntos Jurídicos', 4, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000105', 'Dirección General del Registro Civil', 5, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000106', 'Dirección de Asuntos Religiosos', 6, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000107', 'Coordinación de Protección Civil', 7, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000108', 'Dirección de Publicaciones Oficiales', 8, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000109', 'Centro Estatal de Prevención Social', 9, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000110', 'Coordinación para la Atención de Derechos Humanos', 10, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000111', 'Dirección de Archivo General del Estado', 11, NULL, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000112', 'Dirección de Migración', 12, NULL, 'a0000002-0000-0000-0000-000000000001');

-- 3. Secretaría de Hacienda
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000003-0000-0000-0000-000000000001', 'Secretaría de Hacienda', 3, 'secretaria', NULL),
  ('a0000003-0000-0000-0000-000000000101', 'Subsecretaría de Ingresos', 1, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000102', 'Subsecretaría de Egresos', 2, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000103', 'Subsecretaría de Programación y Presupuesto', 3, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000104', 'Dirección General de Recaudación', 4, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000105', 'Dirección General de Contabilidad Gubernamental', 5, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000106', 'Dirección General de Política Fiscal', 6, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000107', 'Dirección General de Inversión Pública', 7, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000108', 'Dirección de Catastro', 8, NULL, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000109', 'Tesorería', 9, NULL, 'a0000003-0000-0000-0000-000000000001');

-- 4. Secretaría de la Función Pública
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000004-0000-0000-0000-000000000001', 'Secretaría de la Función Pública', 4, 'secretaria', NULL),
  ('a0000004-0000-0000-0000-000000000101', 'Subsecretaría de la Función Pública', 1, NULL, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000102', 'Dirección General de Responsabilidades', 2, NULL, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000103', 'Dirección General de Auditoría Gubernamental', 3, NULL, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000104', 'Dirección General de Modernización Administrativa', 4, NULL, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000105', 'Dirección General de Patrimonio', 5, NULL, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000106', 'Órganos Internos de Control', 6, NULL, 'a0000004-0000-0000-0000-000000000001');

-- 5. Secretaría de Seguridad y Protección Ciudadana
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000005-0000-0000-0000-000000000001', 'Secretaría de Seguridad y Protección Ciudadana', 5, 'secretaria', NULL),
  ('a0000005-0000-0000-0000-000000000101', 'Subsecretaría de Operación Policial', 1, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000102', 'Subsecretaría de Prevención y Reinserción Social', 2, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000103', 'Comisaría General de la Policía Estatal', 3, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000104', 'Dirección General de Centros de Reinserción Social', 4, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000105', 'Dirección General de Prevención del Delito', 5, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000106', 'Academia de Policía', 6, NULL, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000107', 'Centro de Control, Comando, Comunicación y Cómputo (C4)', 7, NULL, 'a0000005-0000-0000-0000-000000000001');

-- 6. Secretaría de Educación
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000006-0000-0000-0000-000000000001', 'Secretaría de Educación', 6, 'secretaria', NULL),
  ('a0000006-0000-0000-0000-000000000101', 'Subsecretaría de Educación Básica', 1, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000102', 'Subsecretaría de Educación Media Superior y Superior', 2, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000103', 'Subsecretaría de Planeación Educativa', 3, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000104', 'Dirección General de Educación Primaria', 4, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000105', 'Dirección General de Educación Secundaria', 5, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000106', 'Dirección General de Educación Indígena', 6, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000107', 'Dirección General de Educación Física', 7, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000108', 'Dirección General de Educación Especial', 8, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000109', 'Dirección General de Educación Inicial y Preescolar', 9, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000110', 'Dirección de Profesiones', 10, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000111', 'Dirección de Becas y Estímulos', 11, NULL, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000112', 'Coordinación Estatal del Servicio Profesional Docente', 12, NULL, 'a0000006-0000-0000-0000-000000000001');

-- 7. Secretaría de Salud
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000007-0000-0000-0000-000000000001', 'Secretaría de Salud', 7, 'secretaria', NULL),
  ('a0000007-0000-0000-0000-000000000101', 'Subsecretaría de Salud', 1, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000102', 'Subsecretaría de Administración y Finanzas', 2, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000103', 'Dirección General de Salud Pública', 3, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000104', 'Dirección General de Calidad y Educación en Salud', 4, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000105', 'Dirección General de Planeación', 5, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000106', 'Dirección de Protección contra Riesgos Sanitarios', 6, NULL, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000107', 'Laboratorio Estatal de Salud Pública', 7, NULL, 'a0000007-0000-0000-0000-000000000001');

-- 8. Secretaría del Campo
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000008-0000-0000-0000-000000000001', 'Secretaría del Campo', 8, 'secretaria', NULL),
  ('a0000008-0000-0000-0000-000000000101', 'Subsecretaría de Agricultura', 1, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000102', 'Subsecretaría de Ganadería', 2, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000103', 'Dirección General de Desarrollo Rural', 3, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000104', 'Dirección General de Infraestructura Hidroagrícola', 4, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000105', 'Dirección General de Fomento Agropecuario', 5, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000106', 'Dirección de Sanidad Vegetal', 6, NULL, 'a0000008-0000-0000-0000-000000000001'),
  ('a0000008-0000-0000-0000-000000000107', 'Dirección de Pesca y Acuacultura', 7, NULL, 'a0000008-0000-0000-0000-000000000001');

-- 9. Secretaría de Desarrollo Económico
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000009-0000-0000-0000-000000000001', 'Secretaría de Desarrollo Económico', 9, 'secretaria', NULL),
  ('a0000009-0000-0000-0000-000000000101', 'Subsecretaría de Desarrollo Económico', 1, NULL, 'a0000009-0000-0000-0000-000000000001'),
  ('a0000009-0000-0000-0000-000000000102', 'Dirección General de Fomento Industrial', 2, NULL, 'a0000009-0000-0000-0000-000000000001'),
  ('a0000009-0000-0000-0000-000000000103', 'Dirección General de Comercio', 3, NULL, 'a0000009-0000-0000-0000-000000000001'),
  ('a0000009-0000-0000-0000-000000000104', 'Dirección General de Minas', 4, NULL, 'a0000009-0000-0000-0000-000000000001'),
  ('a0000009-0000-0000-0000-000000000105', 'Dirección de Inversión Extranjera', 5, NULL, 'a0000009-0000-0000-0000-000000000001'),
  ('a0000009-0000-0000-0000-000000000106', 'Coordinación de Emprendimiento', 6, NULL, 'a0000009-0000-0000-0000-000000000001');

-- 10. Secretaría de Turismo
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000010-0000-0000-0000-000000000001', 'Secretaría de Turismo', 10, 'secretaria', NULL),
  ('a0000010-0000-0000-0000-000000000101', 'Subsecretaría de Turismo', 1, NULL, 'a0000010-0000-0000-0000-000000000001'),
  ('a0000010-0000-0000-0000-000000000102', 'Dirección General de Desarrollo Turístico', 2, NULL, 'a0000010-0000-0000-0000-000000000001'),
  ('a0000010-0000-0000-0000-000000000103', 'Dirección General de Promoción Turística', 3, NULL, 'a0000010-0000-0000-0000-000000000001'),
  ('a0000010-0000-0000-0000-000000000104', 'Dirección de Pueblos Mágicos', 4, NULL, 'a0000010-0000-0000-0000-000000000001');

-- 11. Secretaría de Desarrollo Social
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000011-0000-0000-0000-000000000001', 'Secretaría de Desarrollo Social', 11, 'secretaria', NULL),
  ('a0000011-0000-0000-0000-000000000101', 'Subsecretaría de Desarrollo Social', 1, NULL, 'a0000011-0000-0000-0000-000000000001'),
  ('a0000011-0000-0000-0000-000000000102', 'Dirección General de Atención a Grupos Vulnerables', 2, NULL, 'a0000011-0000-0000-0000-000000000001'),
  ('a0000011-0000-0000-0000-000000000103', 'Dirección General de Programas Sociales', 3, NULL, 'a0000011-0000-0000-0000-000000000001'),
  ('a0000011-0000-0000-0000-000000000104', 'Dirección General de Desarrollo Comunitario', 4, NULL, 'a0000011-0000-0000-0000-000000000001'),
  ('a0000011-0000-0000-0000-000000000105', 'Dirección de Participación Ciudadana', 5, NULL, 'a0000011-0000-0000-0000-000000000001');

-- 12. Secretaría de Obras Públicas
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000012-0000-0000-0000-000000000001', 'Secretaría de Obras Públicas', 12, 'secretaria', NULL),
  ('a0000012-0000-0000-0000-000000000101', 'Subsecretaría de Obras Públicas', 1, NULL, 'a0000012-0000-0000-0000-000000000001'),
  ('a0000012-0000-0000-0000-000000000102', 'Dirección General de Construcción', 2, NULL, 'a0000012-0000-0000-0000-000000000001'),
  ('a0000012-0000-0000-0000-000000000103', 'Dirección General de Proyectos', 3, NULL, 'a0000012-0000-0000-0000-000000000001'),
  ('a0000012-0000-0000-0000-000000000104', 'Dirección General de Conservación de Carreteras', 4, NULL, 'a0000012-0000-0000-0000-000000000001'),
  ('a0000012-0000-0000-0000-000000000105', 'Dirección General de Licitaciones', 5, NULL, 'a0000012-0000-0000-0000-000000000001'),
  ('a0000012-0000-0000-0000-000000000106', 'Dirección de Supervisión de Obra', 6, NULL, 'a0000012-0000-0000-0000-000000000001');

-- 13. Secretaría de Desarrollo Urbano, Vivienda y Ordenamiento Territorial
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000013-0000-0000-0000-000000000001', 'Secretaría de Desarrollo Urbano, Vivienda y Ordenamiento Territorial', 13, 'secretaria', NULL),
  ('a0000013-0000-0000-0000-000000000101', 'Subsecretaría de Desarrollo Urbano', 1, NULL, 'a0000013-0000-0000-0000-000000000001'),
  ('a0000013-0000-0000-0000-000000000102', 'Dirección General de Planeación Urbana', 2, NULL, 'a0000013-0000-0000-0000-000000000001'),
  ('a0000013-0000-0000-0000-000000000103', 'Dirección General de Vivienda', 3, NULL, 'a0000013-0000-0000-0000-000000000001'),
  ('a0000013-0000-0000-0000-000000000104', 'Dirección General de Ordenamiento Territorial', 4, NULL, 'a0000013-0000-0000-0000-000000000001'),
  ('a0000013-0000-0000-0000-000000000105', 'Dirección de Transporte Público', 5, NULL, 'a0000013-0000-0000-0000-000000000001');

-- 14. Secretaría de Medio Ambiente
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000014-0000-0000-0000-000000000001', 'Secretaría de Medio Ambiente', 14, 'secretaria', NULL),
  ('a0000014-0000-0000-0000-000000000101', 'Subsecretaría de Medio Ambiente', 1, NULL, 'a0000014-0000-0000-0000-000000000001'),
  ('a0000014-0000-0000-0000-000000000102', 'Dirección General de Gestión Ambiental', 2, NULL, 'a0000014-0000-0000-0000-000000000001'),
  ('a0000014-0000-0000-0000-000000000103', 'Dirección General de Recursos Naturales', 3, NULL, 'a0000014-0000-0000-0000-000000000001'),
  ('a0000014-0000-0000-0000-000000000104', 'Dirección de Impacto Ambiental', 4, NULL, 'a0000014-0000-0000-0000-000000000001'),
  ('a0000014-0000-0000-0000-000000000105', 'Procuraduría Estatal de Protección al Ambiente', 5, NULL, 'a0000014-0000-0000-0000-000000000001');

-- 15. Secretaría del Trabajo
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000015-0000-0000-0000-000000000001', 'Secretaría del Trabajo', 15, 'secretaria', NULL),
  ('a0000015-0000-0000-0000-000000000101', 'Subsecretaría del Trabajo', 1, NULL, 'a0000015-0000-0000-0000-000000000001'),
  ('a0000015-0000-0000-0000-000000000102', 'Dirección General del Servicio Estatal de Empleo', 2, NULL, 'a0000015-0000-0000-0000-000000000001'),
  ('a0000015-0000-0000-0000-000000000103', 'Dirección General de Inspección del Trabajo', 3, NULL, 'a0000015-0000-0000-0000-000000000001'),
  ('a0000015-0000-0000-0000-000000000104', 'Dirección de Capacitación y Productividad', 4, NULL, 'a0000015-0000-0000-0000-000000000001'),
  ('a0000015-0000-0000-0000-000000000105', 'Procuraduría de la Defensa del Trabajo', 5, NULL, 'a0000015-0000-0000-0000-000000000001');

-- 16. Secretaría de Administración
INSERT INTO organo_centralizado (id, nombre, orden, tipo, parent_id) VALUES
  ('a0000016-0000-0000-0000-000000000001', 'Secretaría de Administración', 16, 'secretaria', NULL),
  ('a0000016-0000-0000-0000-000000000101', 'Subsecretaría de Administración', 1, NULL, 'a0000016-0000-0000-0000-000000000001'),
  ('a0000016-0000-0000-0000-000000000102', 'Dirección General de Recursos Humanos', 2, NULL, 'a0000016-0000-0000-0000-000000000001'),
  ('a0000016-0000-0000-0000-000000000103', 'Dirección General de Recursos Materiales y Servicios Generales', 3, NULL, 'a0000016-0000-0000-0000-000000000001'),
  ('a0000016-0000-0000-0000-000000000104', 'Dirección General de Tecnologías de la Información', 4, NULL, 'a0000016-0000-0000-0000-000000000001'),
  ('a0000016-0000-0000-0000-000000000105', 'Dirección General de Adquisiciones', 5, NULL, 'a0000016-0000-0000-0000-000000000001'),
  ('a0000016-0000-0000-0000-000000000106', 'Dirección de Organización', 6, NULL, 'a0000016-0000-0000-0000-000000000001');

-- ==========================================================================
-- SEED: Catálogo Administración Pública Paraestatal
-- 4 Categorías + ~43 Organismos
-- ==========================================================================

INSERT INTO categoria_paraestatal (id, nombre, orden) VALUES
  (1, 'Organismos Descentralizados', 1),
  (2, 'Empresas de Participación Estatal', 2),
  (3, 'Fideicomisos Públicos', 3),
  (4, 'Organismos Autónomos', 4);

INSERT INTO organo_paraestatal (nombre, orden, categoria_id) VALUES
  -- Organismos Descentralizados (1)
  ('Instituto de Seguridad y Servicios Sociales de los Trabajadores del Estado de Chiapas (ISSTECH)', 1, 1),
  ('Instituto de Comunicación Social y Relaciones Públicas', 2, 1),
  ('Colegio de Estudios Científicos y Tecnológicos del Estado de Chiapas (CECyTECH)', 3, 1),
  ('Colegio de Bachilleres de Chiapas (COBACH)', 4, 1),
  ('Colegio de Educación Profesional Técnica del Estado de Chiapas (CONALEP)', 5, 1),
  ('Instituto de la Consejería Jurídica y de Asistencia Legal', 6, 1),
  ('Instituto de Protección Civil para el Manejo Integral de Riesgos de Desastres del Estado de Chiapas', 7, 1),
  ('Instituto del Agua del Estado de Chiapas', 8, 1),
  ('Instituto de Ciencia, Tecnología e Innovación del Estado de Chiapas', 9, 1),
  ('Sistema Chiapaneco de Radio, Televisión y Cinematografía', 10, 1),
  ('Secretaría Ejecutiva del Sistema Estatal Anticorrupción', 11, 1),
  ('DIF Chiapas', 12, 1),
  ('Instituto de la Juventud del Estado de Chiapas', 13, 1),
  ('Instituto del Deporte del Estado de Chiapas', 14, 1),
  ('Instituto de Población y Ciudades Rurales', 15, 1),
  ('Instituto Estatal del Café', 16, 1),
  ('Tribunal de Justicia Administrativa', 17, 1),
  ('Universidad de Ciencias y Artes de Chiapas (UNICACH)', 18, 1),
  ('Universidad Politécnica de Chiapas', 19, 1),
  ('Universidad Intercultural de Chiapas (UNICH)', 20, 1),
  ('Instituto Tecnológico Superior de Cintalapa', 21, 1),
  -- Empresas de Participación Estatal (2)
  ('Promotora de Vivienda Chiapas', 1, 2),
  ('Sociedad Operadora de la Torre Chiapas', 2, 2),
  ('Sociedad Operadora del Aeropuerto Internacional Ángel Albino Corzo', 3, 2),
  ('Empresa de Transporte Rápido Troncal (Conejobus)', 4, 2),
  ('Chiapas de Corazón Empresarial S.A. de C.V.', 5, 2),
  ('Empresa de Participación Estatal Comercializadora de Maíz', 6, 2),
  -- Fideicomisos Públicos (3)
  ('Fideicomiso para el Desarrollo Económico y Social de Chiapas', 1, 3),
  ('Fideicomiso de Inversión y Administración para la Reactivación y el Desarrollo Económico del Estado de Chiapas', 2, 3),
  ('Fideicomiso Programa de Infraestructura Básica en Regiones Indígenas', 3, 3),
  ('Fideicomiso Ambiental Selva Lacandona', 4, 3),
  ('Fideicomiso Fondo de Protección Social', 5, 3),
  ('Fideicomiso del Sistema de Distribución Conasupo (FIDELIST)', 6, 3),
  ('Fideicomiso Museo de Paleontología', 7, 3),
  ('Fideicomiso de Inversión para Desarrollo Turístico', 8, 3),
  -- Organismos Autónomos (4)
  ('Comisión Estatal de los Derechos Humanos', 1, 4),
  ('Instituto de Elecciones y Participación Ciudadana', 2, 4),
  ('Tribunal Electoral del Estado de Chiapas', 3, 4),
  ('Fiscalía General del Estado', 4, 4),
  ('Instituto de Acceso a la Información Pública', 5, 4),
  ('Universidad Autónoma de Chiapas (UNACH)', 6, 4),
  ('Auditoría Superior del Estado', 7, 4),
  ('Congreso del Estado de Chiapas', 8, 4);

-- Reset sequence for categoria_paraestatal
SELECT setval('categoria_paraestatal_id_seq', (SELECT MAX(id) FROM categoria_paraestatal));
