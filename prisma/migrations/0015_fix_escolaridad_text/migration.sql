-- La columna escolaridad fue creada como VARCHAR(100) en la migración inicial,
-- pero el schema.prisma la declara como String? (TEXT). Con múltiples valores
-- unidos por ", " el contenido puede superar 100 chars y causar un error P2000.
ALTER TABLE "solicitud"
  ALTER COLUMN "escolaridad" TYPE TEXT;
