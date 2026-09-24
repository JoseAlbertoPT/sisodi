FROM node:22-alpine AS base

# --- Dependencias ---
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
# SheetJS (xlsx) se instala desde el tarball oficial versionado en vendor/: la
# versión de npm (0.18.5) está abandonada y tiene vulnerabilidades sin parche.
COPY vendor ./vendor
RUN npm ci

# --- Builder ---
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# --- Runner ---
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output de Next + assets estáticos
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Reemplaza node_modules mínimo del standalone con el completo del builder
# (necesario para correr prisma migrate deploy y seed con tsx)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Crear directorio de uploads con permisos correctos
RUN mkdir -p ./public/uploads && chown -R nextjs:nodejs ./public/uploads

# Entrypoint: corre migrations + seed y luego arranca el servidor
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
