# Revisión de seguridad — SISODIJ (sisodij-client)

- **Fecha:** 2026-09-24 · **Rama:** `dev` (commit `544bdad`)
- **Alcance:** análisis estático del código, la configuración, el despliegue (Dockerfile / docker-compose), el historial de git y las dependencias (`npm audit`). **No** se ejecutó ningún ataque ni se hizo ninguna petición a servidores de producción, de desarrollo ni a servicios externos, salvo la consulta de `npm audit` al registro de npm.
- **Secretos:** en este documento se muestran solo los primeros 4 caracteres, seguidos de `****`.

---

## 1. Veredicto general: **MUY FÁCIL**

El servidor **no autentica ninguna petición**. Tras el login no se emite ninguna cookie, JWT ni token de sesión. El navegador guarda el usuario en `localStorage` y, en cada llamada, envía su propio `usuarioId`, `userId` o `x-user-id`, y el backend lo acepta sin más. Así, cualquiera que llegue por red al puerto 3000 puede hacer lo siguiente:
- cambiar la contraseña de cualquier cuenta, incluida la de un Administrador, sabiendo solo su RFC;
- crear usuarios Administradores;
- leer todas las solicitudes, los adjuntos y los datos personales;
- borrar información o secuestrar los enlaces de firma electrónica.

Todo esto se hace con un navegador o con `curl`, sin herramientas especiales ni conocimientos avanzados.

## 2. Conteo por severidad

| Crítica | Alta | Media | Baja | Informativa |
|:-:|:-:|:-:|:-:|:-:|
| **4** | **6** | **6** | **5** | **3** |

## 3. Tabla de hallazgos

| ID | Severidad | Categoría (OWASP) | Archivo:línea | Confianza |
|---|---|---|---|---|
| C-01 | Crítica | A01/A07 Autenticación inexistente en el servidor | `lib/auth-context.tsx:32`, `lib/validar-sesion.ts:29`, todas las rutas `app/api/**` | Confirmado |
| C-02 | Crítica | A07 Cambio de contraseña sin verificar identidad | `app/api/auth/route.ts:198`, `:274` | Confirmado |
| C-03 | Crítica | A01 Gestión de usuarios sin control de acceso | `app/api/usuarios/route.ts:9`, `:66`; `app/api/usuarios/[id]/route.ts:10-23` | Confirmado |
| C-04 | Crítica | A01 Permisos y menús editables por cualquiera | `app/api/permisos/[userId]/route.ts:58`; `app/api/menus/seed-roles/route.ts:19`; `app/api/menus/rebuild/route.ts:11` | Confirmado |
| A-01 | Alta | A01 Fuga y secuestro de enlaces de firma externa | `app/api/firma-efirma/estado/route.ts:84`; `app/api/firma-efirma/regenerar-token/route.ts:5` | Confirmado |
| A-02 | Alta | A01 IDOR y fuga masiva de datos | `app/api/solicitudes/route.ts:21`; `app/api/adjunto/[id]/descargar/route.ts:5`; `app/api/auth/route.ts:82` | Confirmado |
| A-03 | Alta | A01 Operaciones destructivas sin autenticación | `app/api/adjunto/route.ts:39`; `app/api/historico/[id]/route.ts:41`; `app/api/catalogo/centralizada/[id]/route.ts:76`; `app/api/configuracion/nota-dictamen/route.ts:14`; `app/api/tabulador/[id]/route.ts` | Confirmado |
| A-04 | Alta | A03 XSS almacenado por medio de adjuntos | `app/api/adjunto/route.ts:19-28`; `app/api/adjunto/[id]/descargar/route.ts:26-27` | Confirmado |
| A-05 | Alta | A06 Dependencias vulnerables (3 críticas, 11 altas) | `package.json` (next, nodemailer, xlsx, jspdf) | Confirmado |
| A-06 | Alta | A02/A04 Datos sensibles versionados en git | `backup-ultima-importacion-406-20260922.json`, `.firma-bypass/*.pdf` (54), `scripts/import-honorarios-2026-01.data.json`, `_scratch_dictamen.pdf`, `test_justificacion_3.pdf` | Confirmado (contenido de los PDF: a verificar) |
| M-01 | Media | A07 Recuperación de contraseña débil | `app/api/auth/route.ts:212-272` | Confirmado |
| M-02 | Media | A02 Secretos en el historial de git | `.env` en 10 commits (p. ej. `2a0524e`, `30b6239`) | Confirmado |
| M-03 | Media | A07 Credenciales de administrador por defecto | `prisma/seed/usuarios.ts:6-7,37`; `prisma/create-superadmin.ts:6-8` | Confirmado (su uso en prod: a verificar) |
| M-04 | Media | A05 Despliegue: HTTP plano, BD expuesta, secretos de dev en prod | `docker-compose.yml:8,45-46`; configuración del servidor | Probable |
| M-05 | Media | A05 Faltan cabeceras de seguridad | `next.config.mjs`; no existe `middleware.ts` | Confirmado |
| M-06 | Media | A03 HTML sin escapar en la ventana de impresión | `components/pages/validacion-uefa-page.tsx:375-411` | Probable |
| B-01 | Baja | A05/A09 Mensajes de error internos devueltos al cliente | 27 rutas con `error?.message` | Confirmado |
| B-02 | Baja | A01 Canal SSE abierto a cualquiera | `app/api/events/route.ts:6` | Confirmado |
| B-03 | Baja | A07 El `heartbeat` mantiene viva cualquier sesión | `app/api/auth/route.ts:188` | Confirmado |
| B-04 | Baja | A04 Subida de adjuntos sin límite de tamaño ni de tipo | `app/api/adjunto/route.ts:7-22` | Confirmado |
| B-05 | Baja | A05 Build permisivo y archivos de prueba en el repo | `next.config.mjs:4`; `app/badges-preview/`, `scratch*`, `_tmp-*`, `diff.txt` | Confirmado |
| I-01 | Info | Manejo de la llave privada de la e.firma | `lib/firma-oficio-client.ts:131,168-172` | — |
| I-02 | Info | CSRF (aplicará al introducir cookies de sesión) | — | — |
| I-03 | Info | `EFIRMA_BYPASS` convierte la firma en una simulación | `app/api/firma-efirma/firmar/route.ts:10` | — |

---

## 4. Detalle de hallazgos

### C-01 · Crítica · El servidor no autentica: la identidad la declara el cliente

**Qué es.** El login (`POST /api/auth?action=login`) verifica la contraseña con bcrypt y responde con un JSON con el perfil, pero **no emite ninguna credencial**. El frontend guarda ese JSON en `localStorage["sdtf_user"]` y después envía `usuarioId`, `userId` o `x-user-id` en query, body o cabecera. Las funciones de protección (`checkSesionUsuario`, `requireRol`, `requireCatalogoAdmin`, etc.) solo comprueban que **ese ID exista** y cuál es su rol. Nunca comprueban que quien hace la petición sea ese usuario. De las 77 rutas, unas 55 no llaman a ninguna de esas funciones.

**Cómo lo aprovecharía un atacante.** Obtiene el UUID de un Administrador, lo cual es trivial por C-03 (`GET /api/usuarios` los lista todos). Después lo coloca en cualquier petición y opera como Administrador, UEFA o Verificador: emite dictámenes, firma bloques internos (con `EFIRMA_BYPASS=true` no necesita e.firma), aprueba o rechaza solicitudes, etc.

**Evidencia**
```ts
// lib/auth-context.tsx:32,55
export const AUTH_KEY = "sdtf_user"
localStorage.setItem(AUTH_KEY, JSON.stringify(user))

// lib/validar-sesion.ts — solo valida existencia e inactividad del ID recibido
const existe = await prisma.usuario.findUnique({ where: { id: usuarioId }, ... })

// app/api/firma-efirma/firmar-interno/route.ts:19-25
const { firmanteId, usuarioId, ... } = body          // ← lo manda el cliente
const sesionErr = await checkSesionUsuario(usuarioId)
```

**Dificultad de explotación:** muy baja. Basta con abrir DevTools y editar `localStorage`, o con usar `curl`.

**Corrección.** Emitir una sesión firmada del lado del servidor y derivar la identidad **solo** de ella. El proyecto ya tiene `next-auth` instalado. Una alternativa mínima es una cookie `HttpOnly` con un token aleatorio guardado en la base de datos:

```ts
// lib/session.ts
import { cookies } from "next/headers"
import { randomBytes, createHash } from "crypto"
const COOKIE = "sisodij_sid"
const sha = (s: string) => createHash("sha256").update(s).digest("hex")

export async function crearSesion(usuarioId: string) {
  const token = randomBytes(32).toString("hex")
  await prisma.sesion.create({ data: { usuario_id: usuarioId, token_hash: sha(token),
    expira_en: new Date(Date.now() + 8 * 3600e3) } })
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/" })
}

export async function usuarioActual() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const s = await prisma.sesion.findUnique({ where: { token_hash: sha(token) },
    include: { usuario: { include: { rol: true } } } })
  if (!s || s.expira_en < new Date() || !s.usuario.activo) return null
  return s.usuario
}

// En cada ruta: se ignora cualquier usuarioId que venga del cliente
const yo = await usuarioActual()
if (!yo) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
```

Además conviene agregar un `middleware.ts` que rechace con 401 todo `/api/*` sin cookie, excepto `/api/auth` y las rutas públicas de firma externa. Esto funciona como red de seguridad; la autorización fina sigue en cada ruta.

---

### C-02 · Crítica · Se puede cambiar la contraseña de cualquier cuenta solo con su RFC

**Qué es.** `action=change-password` y `action=recuperar-reset` reciben `{ rfc, nuevaPassword }` y actualizan el hash sin pedir la contraseña actual ni exigir que el código de recuperación se haya validado. El paso `recuperar-codigo` es independiente y **no deja ningún rastro** que `recuperar-reset` revise.

**Cómo lo aprovecharía un atacante.** Obtiene los RFC de todos los usuarios con `GET /api/usuarios` y hace un `POST /api/auth?action=change-password {"rfc":"<RFC admin>","nuevaPassword":"..."}`. Luego inicia sesión como Administrador. `recuperar-reset` además borra el bloqueo por intentos fallidos. Es una toma de control total en dos peticiones.

**Evidencia**
```ts
// app/api/auth/route.ts:198-207
if (action === "change-password") {
  const { rfc, nuevaPassword } = body
  const hash    = await bcrypt.hash(nuevaPassword, 12)
  const updated = await prisma.usuario.updateMany({
    where: { rfc: rfc.trim().toUpperCase(), activo: true },
    data:  { password_hash: hash, must_change_password: false },
  })
```

**Dificultad:** muy baja.

**Corrección**
```ts
// change-password: exigir sesión + contraseña actual
const yo = await usuarioActual()
if (!yo) return err("No autenticado", 401)
const { passwordActual, nuevaPassword } = body
if (!(await bcrypt.compare(passwordActual, yo.password_hash))) return err("Contraseña actual incorrecta", 403)
if (!politicaPasswordOk(nuevaPassword)) return err("La contraseña no cumple la política")
await prisma.usuario.update({ where: { id: yo.id }, data: { password_hash: await bcrypt.hash(nuevaPassword, 12), must_change_password: false } })
await prisma.sesion.deleteMany({ where: { usuario_id: yo.id, NOT: { token_hash: sha(tokenActual) } } })

// recuperar-codigo: en lugar de {ok:true}, devolver un token de un solo uso
const resetToken = randomBytes(32).toString("hex")
await prisma.codigo_recuperacion.update({ where: { id: registro.id },
  data: { usado: true, reset_token_hash: sha(resetToken), expira_en: new Date(Date.now() + 10 * 60e3) } })
return NextResponse.json({ ok: true, resetToken })

// recuperar-reset: exigir ese token (no el RFC)
const reg = await prisma.codigo_recuperacion.findFirst({ where: { reset_token_hash: sha(body.resetToken), expira_en: { gt: new Date() } } })
if (!reg) return err("Enlace inválido o expirado", 400)
```

---

### C-03 · Crítica · Alta, edición y listado de usuarios sin control de acceso

**Qué es.**
- `GET /api/usuarios` devuelve **todos** los usuarios con id, nombre, correo, RFC, rol y cargo a quien lo pida.
- `POST /api/usuarios` crea usuarios con **cualquier rol**, incluido `Administrador`.
- `PATCH /api/usuarios/[id]` modifica cualquier cuenta: rol, contraseña, estado activo o secretaría. La única protección cubre la edición de otro Administrador, y depende de la cabecera `x-user-id`, que el propio atacante controla.

**Cómo lo aprovecharía un atacante.** `POST /api/usuarios {"nombre":"x","correo":"x@x","password":"...","rolNombre":"Administrador"}` le da una cuenta de administrador persistente. O bien, con `PATCH`, desactiva a todos los usuarios o se cambia el rol a sí mismo.

**Evidencia**
```ts
// app/api/usuarios/[id]/route.ts:22-31
if (usuarioActual.rol?.nombre?.toLowerCase() === "administrador") {
  const solicitanteId = req.headers.get("x-user-id")   // ← controlado por el cliente
```

**Dificultad:** muy baja.

**Corrección**
```ts
const yo = await usuarioActual()
if (!yo || yo.rol.nombre !== "Administrador") return err("No autorizado", 403)
// GET: devolver solo los campos necesarios; nunca exponer el listado completo sin rol
```

---

### C-04 · Crítica · Permisos y menús modificables por cualquiera

**Qué es.**
- `PUT /api/permisos/[userId]` reemplaza los menús y acciones de cualquier usuario, por ejemplo para darse la acción `administracion` del catálogo.
- `POST /api/menus/seed-roles` y `POST /api/menus/rebuild` borran y recrean la matriz de menús de **todos los roles**.

Ninguna de estas rutas verifica quién hace la petición.

**Cómo lo aprovecharía un atacante.** Escala sus propios privilegios en el catálogo o en la verificación, o hace un `POST` a `seed-roles` para alterar la navegación de toda la organización (sabotaje).

**Evidencia**
```ts
// app/api/menus/seed-roles/route.ts:19-30
export async function POST() {           // sin req, sin verificación alguna
  ...
  await prisma.rol_menu.deleteMany({ where: { rol_id: rol.id } })
```

**Dificultad:** muy baja. **Corrección:** `requireRol(yo.id, ["Administrador"])` con la identidad tomada de la sesión (C-01). Las rutas de mantenimiento (`seed-roles`, `rebuild`) deberían eliminarse de la API y quedar como scripts de `prisma/seed`.

---

### A-01 · Alta · Fuga y secuestro de los enlaces de firma externa

**Qué es.** `GET /api/firma-efirma/estado?solicitudId=N` no pide autenticación y devuelve el `acceso_token` de cada firmante externo, que es el secreto del enlace público de firma. Los `solicitudId` son enteros consecutivos. `POST /api/firma-efirma/regenerar-token {firmanteId}` tampoco pide autenticación: invalida el enlace del firmante legítimo y le devuelve al atacante uno nuevo. `PATCH /api/firma-efirma/verificar/[id]` y `.../firmante/[id]` tampoco verifican a quien hace la petición.

**Cómo lo aprovecharía un atacante.** Recorre `solicitudId=1..N`, obtiene los tokens y abre el enlace antes que el firmante real. El sistema “ata” el enlace a la primera cookie que llega (`acceder`), así que el firmante legítimo queda bloqueado. Si `EFIRMA_BYPASS=true`, puede además “firmar” con cualquier nombre y RFC. También puede descargar los PDF en proceso de firma.

**Evidencia**
```ts
// app/api/firma-efirma/estado/route.ts:84
acceso_token: f.tipo === "externo" ? f.acceso_token : null,
```

**Dificultad:** baja. **Corrección:** exigir sesión y un rol con acceso a esa solicitud. No devolver nunca `acceso_token` salvo en la respuesta de `iniciar` o `regenerar-token`, y solo a su responsable. Guardar el token como hash (`sha256`) en la BD.

---

### A-02 · Alta · IDOR y extracción masiva de datos

**Qué es.**
- `GET /api/solicitudes?estado=todos` devuelve **todas** las solicitudes con historial, adjuntos y datos del usuario (correo, RFC).
- `GET /api/adjunto/{id}/descargar` sirve cualquier adjunto por id consecutivo.
- `GET /api/auth?action=perfil&id=` y `/api/documento-sellado`, `/api/historico`, `/api/dictamenes`, `/api/dashboard` tampoco validan permisos ni pertenencia.

**Cómo lo aprovecharía un atacante.** Con un script de pocas líneas descarga la base de solicitudes, importes y documentos adjuntos de todas las dependencias.

**Evidencia**
```ts
// app/api/solicitudes/route.ts:25-31
const usuarioId = searchParams.get("usuarioId")
if (usuarioId) where.usuario_id = usuarioId          // si no se envía, no se filtra: devuelve todo
```

**Dificultad:** muy baja. **Corrección:** filtrar siempre por el alcance del usuario de la sesión (`lib/secretaria-scope.ts` ya existe: usarlo en el servidor):
```ts
const yo = await usuarioActual(); if (!yo) return 401
const where = { ...filtrosDelCliente, ...alcancePorRol(yo) }   // nunca confiar en usuarioId del cliente
// adjunto: cargar la solicitud del adjunto y comprobar que yo tiene acceso antes de s3Download
```

---

### A-03 · Alta · Operaciones destructivas sin autenticación

**Qué es.** Cualquiera puede ejecutar `DELETE` sobre adjuntos (y su objeto en S3), sobre registros del histórico, del catálogo centralizado o paraestatal y del tabulador, y `PUT` sobre el texto de la nota de dictamen y el calendario.

**Escenario.** Borrado masivo de evidencia documental o alteración del texto legal que aparece en los dictámenes.

**Dificultad:** muy baja. **Corrección:** sesión + `requireRol`, además de una bitácora de auditoría (quién borró qué) y un borrado lógico donde aplique.

---

### A-04 · Alta · XSS almacenado por medio de adjuntos

**Qué es.** Al subir un adjunto se guarda el `file.type` que declara el cliente. Al descargarlo se devuelve con ese mismo `Content-Type` y `Content-Disposition: inline`, sin `X-Content-Type-Options: nosniff`, y desde el **mismo origen** que la aplicación.

**Escenario.** El atacante sube un `.html` con tipo `text/html` a una solicitud. Cuando un revisor lo abre, el script se ejecuta en el origen de SISODIJ: lee `localStorage["sdtf_user"]` y llama a la API con la identidad de la víctima. Una vez corregida C-01, este sería el vector principal para robar sesiones.

**Evidencia**
```ts
// app/api/adjunto/[id]/descargar/route.ts:26-27
"Content-Type": adjunto.tipo || "application/octet-stream",
"Content-Disposition": `inline; filename="${asciiName}"; ...`,
```

**Dificultad:** baja. **Corrección**
```ts
const PERMITIDOS: Record<string,string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
if (!PERMITIDOS[ext] || file.size > 15 * 1024 * 1024) return 400
// validar también los "magic bytes" (p. ej. %PDF-) y guardar tipo = PERMITIDOS[ext]
// descarga:
headers: { "Content-Type": PERMITIDOS[ext] ?? "application/octet-stream",
  "Content-Disposition": ext === "pdf" ? "inline" : "attachment",
  "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" }
```

---

### A-05 · Alta · Dependencias con vulnerabilidades conocidas

`npm audit --omit=dev` encontró 21 vulnerabilidades: **3 críticas, 11 altas y 7 moderadas**. Las más relevantes:

| Paquete | Versión | Problema | Corrección |
|---|---|---|---|
| `next` | 16.1.6 | *Request smuggling* en rewrites y otras (crítica) | `next@16.3.6` o superior |
| `xlsx` (SheetJS) | 0.18.5 | *Prototype pollution* y ReDoS. **Se procesa del lado del servidor** con archivos subidos por usuarios (`app/api/historico/route.ts:51`) | Sin corrección en npm: migrar a la distribución oficial de SheetJS (`https://cdn.sheetjs.com`) ≥ 0.20.2 o a `exceljs` |
| `nodemailer` | 7.x | Inyección de comandos SMTP | `nodemailer@10.0.10` o superior |
| `jspdf` | 2.5.2 | DoS / ReDoS (crítica), DOMPurify con XSS | `jspdf@4.2.1` o superior |
| `next-auth` | 4.24 | Varias vulnerabilidades (instalado **pero no se usa**) | Actualizar o desinstalar |
| `prisma` y sus dependencias | 7.4 | Vulnerabilidades en `@hono/node-server`, `mysql2`, etc. (herramientas de CLI) | Actualizar a la versión con parche |

**Confianza:** confirmado (salida de `npm audit`). El riesgo real es mayor en `next` y `xlsx`, porque ambos procesan entradas remotas.

---

### A-06 · Alta · Datos sensibles versionados en el repositorio

**Qué es.** El repositorio contiene:
- `backup-ultima-importacion-406-20260922.json` (3.5 MB): 406 solicitudes con importes bruto y neto, objeto del contrato, folios, UUID de usuarios, historial y dictámenes;
- `scripts/import-honorarios-2026-01.data.json`;
- 54 PDF en `.firma-bypass/` (documentos de firma generados), `_scratch_dictamen.pdf` y `test_justificacion_3.pdf`.

Cualquiera con acceso de lectura al remoto de git, o a una copia del repo, obtiene esta información. La imagen Docker **también la incluye**, porque `.dockerignore` no la excluye y el `Dockerfile` hace `COPY . .`.

**Dificultad:** baja (requiere acceso al repo o a la imagen).

**Corrección:**
1. `git rm --cached` de esos archivos y agregarlos a `.gitignore` y `.dockerignore`.
2. Purgarlos del historial con `git filter-repo`, coordinado con el equipo porque reescribe el historial.
3. Revisar quién tiene acceso al remoto. **A verificar:** si los PDF contienen nombres o RFC reales.

---

### M-01 · Media · Recuperación de contraseña débil (aunque C-02 la hace innecesaria)

- **Código generado con `Math.random()`** (`auth/route.ts:224`), un generador no criptográfico. Debe usarse `crypto.randomInt(100000, 1000000)`.
- **Sin límite de intentos** en `recuperar-codigo`. Un código de 6 dígitos (900 000 combinaciones) válido 10 minutos se puede adivinar por fuerza bruta si no hay limitación de velocidad.
- **Enumeración de usuarios:** `recuperar-rfc` responde 404 “No se encontró ninguna cuenta”, el login distingue una cuenta desactivada (403) de credenciales incorrectas, y `GET /api/usuarios?checkRfc=` y `?checkCorreo=` son públicos.
- **Sin limitación de velocidad** en `recuperar-rfc`. Permite bombardear con correos a los usuarios.
- **Sin política de contraseñas** en el servidor. Se acepta `"1"`.

**Corrección:** usar `crypto.randomInt`, un contador de intentos por código (máximo 5, y después invalidarlo), respuestas genéricas (“Si el RFC existe, enviamos un código”), limitar la velocidad por IP y por RFC, y validar la contraseña (longitud ≥ 12 o una política institucional).

### M-02 · Media · Secretos en el historial de git

`.env` estuvo versionado en 10 commits hasta `5b0ca80`. Contenía:
- `DATABASE_URL` con contraseñas de bases **locales** de desarrollo (`rolo****`, `1234****`);
- `EFIRMA_PROJECT_TOKEN=pk_e****` (commits `2a0524e` y `30b6239`).

Se verificó que **los valores actuales** de `POSTGRES_PASSWORD` (`fSrg****`), `FIRMA_OFICIO_TOKEN` (`80a8****`), `AWS_SECRET_ACCESS_KEY` (`7pdu****`) y `SIGEF_APP_ID` (`03d1****`) **no aparecen** en el historial. **Acción:** revocar `pk_e****` si ese proveedor sigue activo y no reutilizar esas contraseñas locales en ningún servidor.

### M-03 · Media · Credenciales de administrador por defecto

`prisma/seed/usuarios.ts:6-7` crea el usuario `ADMI****` con la contraseña fija `Admi****`, `must_change_password: false`, y la imprime en consola (línea 37). `prisma/create-superadmin.ts:8` usa la misma contraseña por defecto si falta `SUPERADMIN_PASSWORD`. **A verificar:** si ese usuario existe con esa contraseña en prod o en dev. **Corrección:** exigir la variable de entorno (fallar si no existe), `must_change_password: true` y no imprimir la contraseña.

### M-04 · Media · Configuración de despliegue

Estos puntos salen de `docker-compose.yml` y de las notas de despliegue del equipo; no se inspeccionó el servidor.
- **Prod se sirve por HTTP plano** (`http://<IP interna>:3000`). Las contraseñas y, sobre todo, **el `.key` de la e.firma y su frase** viajan en claro por la red interna. Cualquiera en la misma red podría capturarlos.
- **PostgreSQL publicado en el host** (`5433:5432`). Si el firewall no lo restringe, la BD queda accesible desde la red.
- **Prod usa temporalmente credenciales de dev** (S3 de dev, `firma-dev`) y un `NEXTAUTH_SECRET` de relleno. Un incidente en dev compromete los archivos de prod y viceversa.
- **La instancia de dev está publicada en internet** (dominio público `dev-sisodij…morelos.gob.mx`) con el mismo código. Todos los hallazgos anteriores son **explotables desde internet** contra dev, y dev comparte el bucket S3 que hoy usa prod.
- Aspecto positivo: el contenedor corre como usuario no root (`nextjs`, uid 1001).

**Corrección:** poner un proxy inverso con TLS (nginx o Traefik) delante del puerto 3000 y dejar de publicar `3000` hacia fuera; quitar `ports: 5433` (la app llega a la BD por la red interna de Docker); usar credenciales propias de prod; restringir dev con VPN, lista de IP permitidas o autenticación básica en el proxy hasta corregir C-01.

### M-05 · Media · Faltan cabeceras de seguridad

No hay `headers()` en `next.config.mjs` ni un `middleware.ts`. Faltan CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options` y `Referrer-Policy`. Esto facilita el *clickjacking* sobre la pantalla de firma y agrava A-04.
```js
// next.config.mjs
async headers() {
  return [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // cuando haya TLS
    { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'" },
  ]}]
},
```

### M-06 · Media · HTML sin escapar en la ventana de impresión del dictamen

`validacion-uefa-page.tsx:375-411` construye HTML con `document.write` interpolando `denominacion`, `secretaria`, `destinatarios` y los nombres de los firmantes sin escapar. Esos campos los captura el usuario solicitante. La ventana `about:blank` hereda el origen, así que un script inyectado lee `localStorage`. **Confianza:** probable, porque depende de qué campos permite capturar el formulario. **Corrección:** escapar cada valor (`escapeHtml`) o generar el documento con React / `@react-pdf` como en las demás plantillas.

---

### B-01 · Baja · Mensajes internos en las respuestas
En 27 rutas se devuelve `error?.message`, que incluye errores de Prisma con nombres de tablas y columnas, y de S3 con claves y bucket. **Corrección:** registrar el error en el servidor y responder un mensaje genérico con un id de correlación.

### B-02 · Baja · SSE sin autenticación
`/api/events` acepta conexiones anónimas ilimitadas: un atacante puede abrir miles de conexiones (DoS) y enterarse de cuándo cambia la información. **Corrección:** exigir sesión y limitar las conexiones por usuario.

### B-03 · Baja · `heartbeat` con cualquier `usuarioId`
Cualquiera puede mantener “activa” la sesión de otro usuario y anular el cierre por inactividad del servidor. Esto se resuelve al corregir C-01.

### B-04 · Baja · Adjuntos sin límite de tamaño ni lista de tipos
Permite agotar el almacenamiento de S3 y la memoria (el archivo se carga completo con `arrayBuffer()`). Las rutas `autografa/upload` y `documento-sellado` **sí** validan: aplicar el mismo criterio en `adjunto`.

### B-05 · Baja · Higiene del build y del repositorio
`typescript.ignoreBuildErrors: true` permite publicar código con errores de tipos. `app/badges-preview` es una página accesible en producción. Hay archivos `scratch*`, `_tmp-*`, `diff.txt`, `.sql` de reparación y un archivo con nombre corrupto en la raíz, además de `pnpm-lock.yaml` y `package-lock.json` a la vez.

### I-01 · Info · Llave privada de la e.firma
El diseño de WSFirmaOficio obliga a enviar `.cer`, `.key` y frase al backend, que los reenvía al WS. Es positivo que se redacten en los logs (`envelopeRedactado`) y que no se persistan. Esto exige TLS de extremo a extremo (M-04) y no guardar nunca el body en logs ni en caché.

### I-02 · Info · CSRF
Hoy no aplica, porque no hay cookies de sesión. Al implementar C-01 con cookies hay que usar `SameSite=Strict` y verificar la cabecera `Origin` en los métodos que modifican datos, o usar un token CSRF.

### I-03 · Info · `EFIRMA_BYPASS`
Con `true`, la firma interna y la externa se simulan: no se validan credenciales y se generan sellos falsos con `Math.random`. Conviene impedir que arranque en producción:
```ts
if (process.env.NODE_ENV === "production" && process.env.EFIRMA_BYPASS === "true" && process.env.ALLOW_BYPASS !== "yes-i-know")
  throw new Error("EFIRMA_BYPASS no permitido en producción")
```

---

## 5. Caminos de entrada más probables (top 3)

1. **Tomar la cuenta de un administrador por RFC (C-02 + C-03).** `GET /api/usuarios` entrega los RFC y luego `POST /api/auth?action=change-password`. Son dos peticiones, sin credenciales, y dan control total de la aplicación. Desde internet se puede hacer contra **dev**; contra prod, desde la red interna.
2. **Suplantar la identidad cambiando `usuarioId` (C-01).** Ni siquiera hace falta cambiar contraseñas: basta poner el UUID de un Administrador o de UEFA en `localStorage` o en el body para operar como esa persona. Es silencioso, porque no genera intentos de login fallidos.
3. **Extraer datos y secuestrar firmas (A-02 + A-01).** Recorrer los ids consecutivos de solicitudes y adjuntos para llevarse toda la información, y leer los `acceso_token` de los firmantes externos para interceptar o bloquear procesos de firma.

## 6. Lo que ya se hace bien

- Contraseñas con **bcrypt** (coste 12) y comparación con `bcrypt.compare`.
- **Bloqueo escalonado** por intentos fallidos de login (5 intentos → 2 min; después 3 → 5 min).
- **Prisma ORM** en todas las consultas. No se encontró SQL concatenado; el único `$executeRawUnsafe` está en un *seed* con SQL estático.
- Tokens de firma externa y `session_id` generados con **`crypto.randomBytes(32)`**, con expiración (TTL de 30 min) y atados a una cookie `HttpOnly` del navegador que abrió el enlace.
- **Redacción** de certificado, llave y frase en los logs del cliente SOAP (`lib/firma-oficio-client.ts:168-172`).
- Correo enmascarado en los logs (`maskEmail`).
- Sin SSRF: las URLs de SIGeF y WSFirmaOficio vienen de variables de entorno, y el parámetro del usuario solo se mapea a un id conocido.
- Sin *path traversal* en `firma-efirma/pdf`: el `uuid` se valida contra la BD antes de leer del disco.
- Contenedor Docker **no root**, *multi-stage*, `.env` fuera de git y de la imagen (a partir de `5b0ca80`), y bucket S3 privado servido a través del backend.
- El seed ya no corre automáticamente en cada arranque (`RUN_SEED`).
- Hay tests (`vitest`) para rutas críticas.

---

## 7. Plan de refuerzo (por prioridad)

> Todavía no se aplicó ningún cambio. Cada fase requiere tu aprobación.

### Fase 0 — Contención inmediata (horas; mayormente configuración, sin código)
1. **Restringir el acceso a la instancia de dev** publicada en internet (VPN, lista de IP o autenticación básica en el proxy) mientras siga C-01.
2. **Deshabilitar `change-password` y `recuperar-reset`** tal como están: parche mínimo que exija la contraseña actual o un token de reset (C-02). Es el cambio más barato con mayor impacto.
3. **Proteger `GET/POST /api/usuarios`, `PATCH /api/usuarios/[id]`, `PUT /api/permisos/*`, `menus/seed-roles` y `menus/rebuild`** con una verificación temporal (ver fase 1). Como mínimo, eliminar las dos rutas de menús de la API.
4. Revisar en la BD de prod y dev **si existen administradores creados o contraseñas cambiadas recientemente** (indicadores de compromiso) y si existe el admin del seed con la contraseña por defecto (M-03).
5. Quitar `ports: 5433` del compose de prod y verificar que `EFIRMA_BYPASS=false` en prod.

### Fase 1 — Autenticación real (1–3 días)
6. Implementar la sesión del lado del servidor (cookie `HttpOnly`/`Secure`/`SameSite=Strict` + tabla `sesion`, o `next-auth` que ya está instalado) y un `usuarioActual()` único (C-01).
7. Agregar un `middleware.ts` que exija sesión en `/api/*`, excepto login, recuperación y rutas públicas de firma con token.
8. Sustituir **en todas las rutas** el `usuarioId`/`userId`/`x-user-id` del cliente por `usuarioActual()`, y aplicar `requireRol` o alcance por secretaría (C-03, C-04, A-02, A-03, B-02, B-03). Agregar tests que verifiquen 401/403 por ruta.
9. Invalidar sesiones al cambiar contraseña o rol y al desactivar un usuario (reutilizar `broadcastForceLogout`).

### Fase 2 — Firma, archivos y recuperación (1–2 días)
10. `firma-efirma/estado` y `regenerar-token`: exigir sesión y rol, no devolver `acceso_token` y guardarlo como hash (A-01).
11. Adjuntos: lista de extensiones permitidas, verificación de *magic bytes*, límite de 15 MB, `nosniff`, `attachment` para lo que no sea PDF y verificación de pertenencia (A-04, B-04).
12. Recuperación de contraseña: `crypto.randomInt`, máximo de intentos por código, respuestas genéricas, limitación de velocidad y política de contraseñas (M-01).
13. Escapar el HTML de la ventana de impresión (M-06).

### Fase 3 — Plataforma y dependencias (1–2 días)
14. Actualizar `next` a ≥ 16.3.6, `nodemailer` ≥ 10.0.10 y `jspdf` ≥ 4.2.1; reemplazar `xlsx` 0.18.5 por SheetJS ≥ 0.20.2 (CDN oficial) o `exceljs`; desinstalar `next-auth` si no se adopta. Ejecutar la suite de tests (A-05).
15. Cabeceras de seguridad en `next.config.mjs` (M-05).
16. TLS delante de prod (proxy inverso) y credenciales S3 y de firma propias de prod, separadas de dev (M-04).
17. Mensajes de error genéricos (B-01); bloquear `EFIRMA_BYPASS` en producción (I-03); quitar `ignoreBuildErrors` y `app/badges-preview` (B-05).

### Fase 4 — Limpieza del repositorio (coordinada con el equipo)
18. Sacar de git y de la imagen el respaldo JSON, `.firma-bypass/`, los PDF de prueba y los scripts temporales; actualizar `.gitignore` y `.dockerignore` (A-06).
19. Purgar el historial con `git filter-repo` (A-06, M-02) y revocar `pk_e****`.
20. Seed sin contraseña fija (M-03).

---

## 8. Estado de la corrección (2026-09-24, rama `dev`, sin commit)

### ✅ Corregido en código
| Hallazgo | Qué se hizo |
|---|---|
| C-01 | Sesión del lado del servidor (`lib/session.ts`): cookie HttpOnly con un token aleatorio y solo su hash en la tabla `sesion` (migración `20260924120000`). **Todas** las rutas de `/api` exigen sesión, salvo login/recuperación, la firma externa por token y el SSE. Los ids que manda el cliente (`usuarioId`, `userId`, `x-user-id`) deben coincidir con los de la sesión. El test `app/api/rutas-protegidas.test.ts` falla si una ruta nueva olvida la protección. |
| C-02 | `change-password` exige la contraseña actual, con el mismo bloqueo por intentos que el login. `recuperar-reset` exige un `resetToken` de un solo uso emitido al validar el código. Ambos cierran las sesiones abiertas. |
| C-03 | Crear o editar usuarios requiere acceso al menú "Usuarios" (o ser Administrador). Solo un Administrador crea, edita o promueve a Administrador. El RFC ya no se envía a quien no gestiona usuarios. Al cambiar rol, contraseña o estado también se invalidan las sesiones en el servidor. |
| C-04 | `/api/permisos/*` exige gestión de usuarios; `menus/seed-roles` y `menus/rebuild` solo Administrador. |
| A-01 | `firma-efirma/estado`, `regenerar-token`, `verificar` y `firmante` exigen sesión: ya no son accesibles sin iniciar sesión. |
| A-02, A-03 | Todo requiere sesión: se acabó el acceso anónimo a solicitudes, adjuntos, histórico, catálogos, etc. |
| A-04 | Los adjuntos que no son PDF ni imagen se sirven como descarga (`attachment`, `octet-stream`) con `nosniff`. Límite de 50 MB, igual al del formulario. |
| A-05 | `next` 16.1.6 → **16.3.6**, `nodemailer` → **10.0.10**, `xlsx` → **SheetJS 0.20.3** oficial (en `vendor/`; el Dockerfile lo copia), y se eliminaron `jspdf` y `next-auth` (no se usaban). `npm audit`: de 21 vulnerabilidades (3 críticas) a **4 altas, todas dentro del CLI de Prisma**. |
| A-06 | El respaldo JSON, los 54 PDF de `.firma-bypass/` y 2 PDF de prueba salen del índice de git (siguen en disco) y se agregaron a `.gitignore` y `.dockerignore`. |
| M-01 | Código de recuperación con `crypto.randomInt`, máximo 5 intentos por código y 30 s mínimos entre envíos. |
| M-03 | Los seeds ya no traen contraseña fija: usan una variable de entorno o generan una aleatoria, siempre con `must_change_password`. |
| M-05 | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` y CSP en modo **Report-Only**. |
| M-06 | Valores escapados en la ventana de impresión del dictamen. |
| B-01 | `lib/error-publico.ts`: ya no se devuelven al cliente errores de Prisma, S3 o del sistema; los mensajes de negocio se conservan. |
| B-03 | El heartbeat usa el usuario de la sesión. |
| I-03 | Aviso en el log al arrancar si `EFIRMA_BYPASS=true` en producción. |

**Verificación:** 117/118 tests pasan (el único que falla, `filtro` › "folioRecepcion válido…", ya fallaba antes de los cambios). No hay errores de TypeScript nuevos (siguen los 46 anteriores). `npm run build` termina sin errores. Prueba local de humo sobre el build: sin sesión, las rutas protegidas responden 401, las de firma externa y la pantalla de login siguen respondiendo, y las cabeceras están presentes.
**No se probó con base de datos**: la migración nueva no se aplicó a la base local. Hay que probar en dev el login, el cambio de contraseña, la recuperación y un flujo completo de solicitud → firma.

### ⚠️ Efectos esperados al desplegar
- **Todos tendrán que volver a iniciar sesión una vez.** Verán "Por seguridad, vuelve a iniciar sesión."
- La migración se aplica sola al arrancar el contenedor (`prisma migrate deploy` del entrypoint).
- Con el cambio de "Mis permisos", los que no son Administrador ya no pueden crear ni promover administradores.

### ⏳ Pendiente: servidor (infraestructura)
- HTTPS en prod. Con eso la cookie se marca `Secure` automáticamente y se puede activar HSTS.
- Cerrar el puerto 5433, restringir el acceso a dev, credenciales propias de prod y confirmar `EFIRMA_BYPASS=false`.
- Revisar en la BD de prod si hubo abuso previo (administradores o cambios de contraseña recientes).
- Configurar SMTP: sin él, la recuperación de contraseña no puede enviar el código.
- Revocar `pk_e****`. Purga del historial de git (opcional; rompe el flujo de la rama del servidor).

### ✅ Segunda ronda (2026-09-30)
- Nuevo `requireMenu(userId, menuKey)` en `lib/api-guard.ts`: exige que el usuario vea la pantalla (misma regla que el sidebar; Administrador siempre).
- Calendario, Nota y Tabulador (escrituras) → menú `calendario`. Catálogos centralizada/paraestatal e importaciones → menú `entidades`.
- `catalogo-justificaciones/sincronizar` (POST) → administrador de Catálogo.
- `permisos-captura`: otorgar y revocar → gestión de usuarios; consumir → solo el dueño del permiso (antes cualquiera podía darse permiso de captura).
- `rutas-protegidas.test.ts` verifica estas guardas.

### ⏳ Pendiente: código que requiere decisión de negocio (no se hizo para no romper flujos)
- `historico` (POST/DELETE): la tabla no tiene dueño y también se usa desde Nueva solicitud; queda solo con sesión.
- **Alcance de datos entre usuarios con sesión.** Cualquier usuario con sesión puede consultar por API solicitudes y adjuntos de otras dependencias. Para cerrarlo hay que definir qué ve cada rol.
- **Roles en operaciones de catálogo, tabulador, histórico, configuración y firma.** Hoy basta con tener sesión. Falta definir qué roles pueden hacer cada una.
- **Guardar los tokens de firma externa como hash.** El panel necesita volver a mostrar el enlace, así que no se aplicó.
- **Pasar la CSP a modo bloqueante**, tras revisar la consola del navegador en dev.
- `/api/events` sigue siendo público (bajo riesgo).
- `ignoreBuildErrors` se queda hasta corregir los 46 errores de tipos que ya existían.
- Vulnerabilidades del CLI de Prisma: esperar una versión 7.x con parche.
