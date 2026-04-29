# SISODIJ — Sistema de Solicitudes y Dictámenes

Sistema de gestión de solicitudes de recursos humanos con firma electrónica. Desarrollado con Next.js 16, Prisma y PostgreSQL.

---

## Requisitos

- Node.js 22+
- PostgreSQL 16+
- npm

---

## Variables de entorno

Copiar `.env.example` a `.env` y configurar cada variable:

```bash
cp .env.example .env
```

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://user:pass@host:5432/sisodij` |
| `NEXTAUTH_SECRET` | Clave secreta para JWT (mínimo 32 chars) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL pública de la aplicación | `https://sisodij.gob.mx` |
| `NEXT_PUBLIC_API_URL` | URL pública del API (esta misma app) | `https://sisodij.gob.mx/api` |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app | `https://sisodij.gob.mx` |
| `EFIRMA_PORTAL_URL` | URL del portal e.firma | `https://efirma.gob.mx` |
| `EFIRMA_PROJECT_TOKEN` | Token del proyecto en e.firma | `pk_xxxx` |
| `EFIRMA_BYPASS` | `false` en producción siempre | `false` |

---

## Setup local (desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# editar .env con los valores correctos

# 3. Correr migraciones
npx prisma migrate deploy

# 4. Cargar datos iniciales (roles, estados, catálogos, usuario admin)
npm run seed

# 5. Cargar catálogo de administración pública (SQL)
psql $DATABASE_URL -f prisma/seed-catalogos.sql

# 6. Iniciar servidor de desarrollo
npm run dev
```

---

## Deployment en producción

### Opción A — Docker Compose (recomendado)

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd sisodij-client

# 2. Crear archivo .env con variables de producción
cp .env.example .env
# Editar .env con los valores reales de producción

# Agregar también estas variables en el .env:
# POSTGRES_USER=sisodij
# POSTGRES_PASSWORD=<contraseña-segura>
# POSTGRES_DB=sisodij

# 3. Levantar servicios
docker compose up -d --build

# 4. Correr migraciones (solo la primera vez o cuando haya nuevas)
docker compose exec app npx prisma migrate deploy

# 5. Cargar datos iniciales (solo la primera vez)
docker compose exec app npm run seed
docker compose exec db psql -U sisodij -d sisodij -f /app/prisma/seed-catalogos.sql

# 6. Verificar que la app está corriendo
docker compose logs -f app
```

### Opción B — Sin Docker

```bash
# 1. Instalar dependencias de producción
npm ci

# 2. Generar cliente Prisma
npx prisma generate

# 3. Correr migraciones
npx prisma migrate deploy

# 4. Build de producción
npm run build

# 5. Cargar datos iniciales (solo la primera vez)
npm run seed
psql $DATABASE_URL -f prisma/seed-catalogos.sql

# 6. Iniciar servidor
npm start
```

---

## Base de datos

- Motor: PostgreSQL 16
- ORM: Prisma 7
- 26 modelos
- 9 migraciones versionadas en `prisma/migrations/`

### Usuario administrador por defecto

Creado automáticamente por el seed:

| Campo | Valor |
|---|---|
| RFC | `ADMI000000AA0` |
| Contraseña | `Admin123!` |
| Correo | `admin@sisodij.gob.mx` |

**Cambiar la contraseña del admin después del primer login.**

---

## Estructura relevante

```
prisma/
  schema.prisma        # Esquema de la base de datos
  seed.ts              # Datos iniciales (roles, estados, admin, calendario)
  seed-catalogos.sql   # Catálogo de administración pública centralizada
  migrations/          # Migraciones versionadas

app/
  api/                 # API Routes de Next.js

components/            # Componentes React

public/
  uploads/             # Archivos subidos por usuarios (usar volumen persistente)
```

---

## Puerto por defecto

La aplicación corre en el puerto **3000**.
