-- Corrige el typo "GOBERNATURA" -> "GUBERNATURA" en secretaria_txt_snapshot.
-- El campo secretaria (no snapshot) ya estaba bien escrito en estos registros;
-- el catálogo de justificaciones prioriza secretaria_txt_snapshot cuando existe,
-- por eso el typo hacía que "Jefatura de la Oficina de la Gubernatura del Estado"
-- apareciera como dos secretarías distintas en el filtro.
UPDATE solicitud
SET secretaria_txt_snapshot = REPLACE(secretaria_txt_snapshot, 'GOBERNATURA', 'GUBERNATURA')
WHERE secretaria_txt_snapshot ILIKE '%GOBERNATURA%';
