-- ============================================================================
-- RECUPERACIÓN: regresar usuarios a Centralizada y mostrar sus solicitudes
-- ============================================================================
-- Contexto: un seed dejó a los usuarios con secretaria_id = NULL (se ven como
-- Paraestatal) y recreó los órganos con IDs nuevos, por lo que las solicitudes
-- (secretaria_id_snapshot) apuntan a órganos viejos y no aparecen.
--
-- Este script:
--   PASO A  -> restaura el secretaria_id de los usuarios (por su clave en el texto)
--   PASO B  -> re-apunta la "foto" (secretaria_id_snapshot) de las solicitudes
--              a la secretaría (ya restaurada) de su usuario creador.
--
-- IMPORTANTE:
--   * HAZ UN RESPALDO de la base antes de ejecutar.
--   * Va dentro de una transacción: revisa las verificaciones y, si todo está
--     bien, ejecuta COMMIT. Si algo se ve mal, ejecuta ROLLBACK.
-- ============================================================================

BEGIN;

-- ---------- PASO A: restaurar secretaria_id de los usuarios ----------
UPDATE usuario u
SET secretaria_id = oc.id
FROM organo_centralizado oc
WHERE u.secretaria_id IS NULL
  AND u.secretaria_texto LIKE '%>%'
  AND oc.ua_clave_administrativa = trim(split_part(u.secretaria_texto, '>', 2));

-- ---------- PASO B: re-apuntar la "foto" de las solicitudes ----------
UPDATE solicitud s
SET secretaria_id_snapshot = u.secretaria_id
FROM usuario u
WHERE s.usuario_id = u.id
  AND u.secretaria_id IS NOT NULL
  AND (s.tipo_administracion IS NULL OR s.tipo_administracion <> 'paraestatal');

-- ---------- VERIFICACIÓN (revisa estos resultados antes de confirmar) ----------

-- 1) Cuántos usuarios quedan Centralizada vs Paraestatal
SELECT
  COUNT(*) FILTER (WHERE oc.id IS NOT NULL) AS usuarios_centralizada,
  COUNT(*) FILTER (WHERE oc.id IS NULL)     AS usuarios_paraestatal
FROM usuario u
LEFT JOIN organo_centralizado oc ON oc.id = u.secretaria_id;

-- 2) Cuántas solicitudes quedaron con "foto" válida (apuntando a un órgano existente)
SELECT
  COUNT(*)                                                                    AS total_solicitudes,
  COUNT(*) FILTER (WHERE oc.id IS NOT NULL)                                   AS con_snapshot_valido,
  COUNT(*) FILTER (WHERE s.secretaria_id_snapshot IS NOT NULL AND oc.id IS NULL) AS snapshot_aun_huerfano
FROM solicitud s
LEFT JOIN organo_centralizado oc ON oc.id = s.secretaria_id_snapshot;

-- ============================================================================
-- Si las verificaciones se ven bien (usuarios_centralizada subió y
-- snapshot_aun_huerfano ~ 0), CONFIRMA con:
--     COMMIT;
-- Si algo salió mal, DESHAZ todo con:
--     ROLLBACK;
-- ============================================================================
