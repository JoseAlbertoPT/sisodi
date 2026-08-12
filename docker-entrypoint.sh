#!/bin/sh
set -e

echo "==> Aplicando migraciones de Prisma..."
npx prisma migrate deploy

# El seed NO se ejecuta automáticamente en cada arranque para evitar que borre
# datos en producción (seedSecretarias recreaba organo_centralizado y dejaba en NULL
# el secretaria_id de los usuarios, haciéndolos ver como "paraestatal").
# Para poblar una base VACÍA por primera vez, ejecutar manualmente:  npx tsx prisma/seed.ts
# Si se requiere el seed automático solo cuando la base está vacía, poner RUN_SEED=true.
if [ "$RUN_SEED" = "true" ]; then
  echo "==> Ejecutando seed (RUN_SEED=true)..."
  npx tsx prisma/seed.ts || echo "Seed falló o ya estaba aplicado, continuando..."
else
  echo "==> Seed OMITIDO en arranque (RUN_SEED != true)."
fi

echo "==> Arrancando Next.js..."
exec node server.js
