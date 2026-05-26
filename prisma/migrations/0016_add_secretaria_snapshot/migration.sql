-- Add secretaria snapshot columns to solicitud
-- These store the creator's secretaria at the time of creation,
-- so filtering is stable even if the user later changes secretaria or tipo.

ALTER TABLE solicitud
  ADD COLUMN IF NOT EXISTS secretaria_id_snapshot  UUID,
  ADD COLUMN IF NOT EXISTS secretaria_txt_snapshot VARCHAR(512);

-- Backfill existing centralizada solicitudes using creator's current secretaria_id
UPDATE solicitud s
SET    secretaria_id_snapshot = u.secretaria_id
FROM   usuario u
WHERE  s.usuario_id = u.id
  AND  s.secretaria_id_snapshot IS NULL
  AND  (s.tipo_administracion = 'centralizada' OR s.tipo_administracion IS NULL)
  AND  u.secretaria_id IS NOT NULL;

-- Backfill existing paraestatal solicitudes using creator's current secretaria_texto
UPDATE solicitud s
SET    secretaria_txt_snapshot = u.secretaria_texto
FROM   usuario u
WHERE  s.usuario_id = u.id
  AND  s.secretaria_txt_snapshot IS NULL
  AND  s.tipo_administracion = 'paraestatal'
  AND  u.secretaria_texto IS NOT NULL;
