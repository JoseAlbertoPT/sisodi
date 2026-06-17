-- Move Dictámenes (id=10) under GESTIÓN DGDO (id=6)
UPDATE menu SET parent_id = 6, orden = 4 WHERE key = 'dictamenes';
