-- ============================================================
-- DIAGNÓSTICO DE USUARIOS  (SOLO LECTURA — no modifica nada)
-- ============================================================
-- Objetivo: comprobar si el despliegue dejó a los usuarios sin
-- secretaria_id, lo que provoca que:
--   (a) todos se vean como "Paraestatal", y
--   (b) sus solicitudes "centralizadas" desaparezcan de "Mis Solicitudes".
--
-- CONTEXTO (para quien ejecuta el deploy):
--   - El tipo Centralizada/Paraestatal NO se guarda: se CALCULA según si el
--     secretaria_id del usuario apunta a un organo_centralizado.
--   - El docker-entrypoint.sh corre "npx tsx prisma/seed.ts" en CADA arranque
--     del contenedor. Ese seed hacía:
--         UPDATE usuario SET secretaria_id = NULL ...
--         (y recreaba organo_centralizado con IDs nuevos)
--     Por eso, tras el deploy, todos los usuarios quedaron con secretaria_id
--     en NULL y se ven como Paraestatal.
--   - Evidencia en los logs del deploy: buscar el mensaje "organo_centralizado limpiado".
--
-- Estas consultas son SELECT/COUNT: no cambian ningún dato.
-- ============================================================


-- 1) Resumen general: cuántos usuarios perdieron el secretaria_id
--    pero conservan el texto (esos son recuperables).
SELECT
  COUNT(*)                                                 AS total_usuarios,
  COUNT(*) FILTER (WHERE secretaria_id IS NULL)            AS sin_secretaria_id,
  COUNT(*) FILTER (WHERE secretaria_id IS NOT NULL)        AS con_secretaria_id,
  COUNT(*) FILTER (WHERE secretaria_id IS NULL
                   AND secretaria_texto IS NOT NULL)       AS recuperables_por_texto
FROM usuario;


-- 2) Detalle: lista de usuarios afectados (secretaria_id NULL) con el texto
--    que SÍ conservan. Ese texto es lo que permite volver a vincularlos.
SELECT
  nombre,
  correo,
  secretaria_id,      -- debería salir NULL en los afectados
  secretaria_texto    -- el nombre/clave de su secretaría, intacto
FROM usuario
WHERE secretaria_id IS NULL
ORDER BY nombre;


-- 3) Confirmar que los órganos centralizados SÍ existen
--    (el seed los recreó con IDs nuevos; por eso se rompió el vínculo).
SELECT COUNT(*) AS total_organos_centralizados
FROM organo_centralizado;


-- ============================================================
-- QUÉ SE DEBERÍA VER
--   Consulta 1: sin_secretaria_id ≈ total y recuperables_por_texto alto  -> confirma el problema.
--   Consulta 2: lista de usuarios con secretaria_id NULL pero secretaria_texto lleno.
--   Consulta 3: un número > 0  -> los órganos existen, listos para re-vincular.
-- ============================================================
