-- Renombra el rol "Validador" a "Verificador" en todo el sistema.
-- No cambia rol.id ni usuario.rol_id, así que no afecta relaciones existentes.
UPDATE rol SET nombre = 'Verificador' WHERE nombre = 'Validador';
