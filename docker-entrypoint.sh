#!/bin/sh
set -e

echo "==> Aplicando migraciones de Prisma..."
npx prisma migrate deploy

echo "==> Ejecutando seed..."
npx tsx prisma/seed.ts || echo "Seed falló o ya estaba aplicado, continuando..."

echo "==> Arrancando Next.js..."
exec node server.js
