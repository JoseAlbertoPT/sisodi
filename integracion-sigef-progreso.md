# Integración SIGeF (ControlProyectosServicio) — Estado actual

Objetivo: que el campo **"Programa o Proyecto"** del formulario Nueva Solicitud deje de depender de captura manual y se llene consultando el Web Service SOAP de SIGeF, filtrado por la Secretaría del usuario.

Última actualización de este documento: 2026-08-17.

## Resumen ejecutivo

| | Estado |
|---|---|
| Cliente SOAP + parsing de la respuesta | ✅ Implementado, con manejo de errores corregido |
| Endpoint interno que expone esto al frontend | ✅ Implementado |
| Timeout ante servicio caído/no disponible | ✅ Implementado (10s por default, configurable) |
| Aviso visible al usuario si SIGeF falla | ✅ Implementado (antes era silencioso) |
| Campo "Programa o Proyecto" en ambos formularios | ✅ Implementado, con fallback al comportamiento anterior |
| Mapeo `idUnidad` por Secretaría | ⚠️ Solo hay **1 valor confirmado** (`530`) — pendiente con SIGeF |
| Prueba contra el WS real (no mockeado) | ❌ No realizada — requiere acceso a la red interna `192.168.114.116:8080` |
| Variables de entorno en staging/producción | ❌ No verificado — solo están documentadas en `.env.example` |

**En una frase:** el código está listo y probado contra respuestas simuladas (incluyendo casos de error y timeout), pero **nunca se ha ejecutado contra el servicio real**, y solo una Secretaría tiene el `idUnidad` necesario para activarse — el resto sigue funcionando exactamente igual que antes (catálogo interno / captura manual) hasta que se configure su `idUnidad`.

## Archivos implementados

- **`lib/sigef-client.ts`** — cliente SOAP. Arma el envelope XML a mano (no se agregó ninguna librería SOAP), hace el POST con timeout, extrae `<proyectosReturn>` con regex y parsea el JSON anidado que trae adentro.
- **`app/api/sigef/proyectos/route.ts`** — `GET /api/sigef/proyectos?secretaria=<nombre>`. Resuelve el `idUnidad` de esa Secretaría, llama al cliente SOAP, filtra y deduplica resultados. Si la Secretaría no tiene `idUnidad` configurado, responde `{ configured: false }` (no es un error).
- **`prisma/schema.prisma`** + **`prisma/migrations/20260814220000_add_sigef_id_unidad/`** — nuevo campo nullable `sigef_id_unidad` en `organo_centralizado`, para asignarle a cada Secretaría (nodo raíz) su `idUnidad` de SIGeF.
- **`app/api/catalogo/centralizada/[id]/route.ts`** — el `PATCH` ya acepta `sigef_id_unidad`, así que se puede configurar por API aunque no exista una pantalla dedicada.
- **`components/pages/nueva-solicitud-page.tsx`**:
  - Hook `useProgramasSigef(secretaria)`: hace el fetch a `/api/sigef/proyectos`, expone `{ proyectos, cargando, configured, error }`.
  - `FormularioPrestacion` y `FormularioNombramiento`: el campo "Programa o Proyecto" usa `SelectConBusqueda` con las opciones de SIGeF cuando `sigef.configured === true`; si no, cae al catálogo interno/Excel o a captura manual (comportamiento previo, sin cambios).
  - Aviso visible (`text-destructive`, ícono `AlertCircle`) cuando `sigef.error` tiene contenido, con el mensaje real del error.
- **`.env.example`** — documenta `SIGEF_WS_URL`, `SIGEF_APP_ID`, `SIGEF_TIMEOUT_MS`.

## Cómo funciona (flujo end-to-end)

1. El usuario abre Nueva Solicitud; el formulario ya conoce su Secretaría (`secretariaConfirmada`).
2. `useProgramasSigef(secretariaConfirmada)` llama a `GET /api/sigef/proyectos?secretaria=<nombre>`.
3. La API busca en `organo_centralizado` el nodo raíz (`parent_id = null`) cuyo `nombre` coincide (case-insensitive) y lee su `sigef_id_unidad`.
   - Si es `null` → responde `{ configured: false, proyectos: [] }`. El formulario sigue igual que antes de esta integración.
   - Si tiene valor → llama a `consultarProyectosSigef(idUnidad)`.
4. `consultarProyectosSigef` arma el SOAP request `[{"appId": "...", "idUnidad": N}]`, hace el POST con timeout, y parsea la respuesta (ver sección de errores abajo).
5. La API filtra los proyectos por `idUnidad` exacto, deduplica por clave `proyecto`, y regresa `{ configured: true, proyectos: [{ value, label }] }` con `value`/`label` en formato `"010001 - Nombre del proyecto"`.
6. El campo se vuelve un `SelectConBusqueda` de solo selección (no captura libre) con esas opciones.

## Manejo de errores (los 3 casos, corregidos)

`parseProyectosReturn` en `lib/sigef-client.ts` distingue 3 casos con manejo independiente (no comparten un mismo `catch`, que era el bug original):

- **JSON exterior mal formado** (el WS a veces no escapa las comillas internas del campo `message`) → se recorta el arreglo de proyectos con una expresión regular.
- **`error != 0`** (error de negocio de SIGeF, JSON exterior válido) → se propaga el mensaje real, ej. `"SIGeF respondió error=3: [CODIGO:3] Unidad no autorizada"`.
- **`error === 0` pero `message` no es JSON de proyectos válido** → error de formato distinto a los otros dos, con su propio mensaje.

Ese mensaje viaja intacto: `consultarProyectosSigef` lo lanza → la API route lo devuelve como `{ error }` con status `502` → el hook lo lee del body (antes se descartaba sin leerlo) y lo expone en `sigef.error` → se muestra en pantalla junto al campo.

**Timeout:** `consultarProyectosSigef` pasa `signal: AbortSignal.timeout(SIGEF_TIMEOUT_MS ?? 10000)` al `fetch`. Si SIGeF no responde a tiempo, rechaza con `"SIGeF no respondió en Nms (timeout)"` en vez de colgar la request indefinidamente.

## Pruebas realizadas

Todas con `fetch` **mockeado** (nunca se llamó al WS real):

1. Respuesta exitosa con el ejemplo real (comillas escapadas) → parsea correctamente.
2. Mismo caso con comillas sin escapar → parsea vía el fallback regex.
3. `error: 3` de negocio → propaga `"SIGeF respondió error=3: [CODIGO:3] Unidad no autorizada"` hasta el frontend, verificado paso a paso (API route → hook → UI).
4. Timeout (servicio no responde) → rechaza a los ~1s (con `SIGEF_TIMEOUT_MS` bajado para la prueba) con mensaje claro, en vez de colgarse.

## Pendientes

1. **Mapeo completo Secretaría → `idUnidad`.** Solo se confirmó `idUnidad: 530` (Jefatura de la Oficina de la Gubernatura del Estado). Falta que el equipo de SIGeF entregue el resto. Mientras tanto, cualquier Secretaría sin `sigef_id_unidad` configurado sigue funcionando con el catálogo interno/captura manual — es el comportamiento esperado, no un error.
2. **Prueba contra el ambiente real.** Nadie ha confirmado que el servidor donde corre el backend de Next.js tenga alcance de red hacia `192.168.114.116:8080` (la IP es de red interna; si el backend corre en otro servidor al que se usó para probar con SoapUI, puede que no tenga acceso). Falta:
   - `curl` o prueba de conectividad desde el servidor real.
   - Probar con `idUnidad: 530` real y confirmar que el select se llena en el formulario de verdad.
   - Forzar un `idUnidad` que dé error, para confirmar que el aviso aparece en pantalla.
3. **Variables de entorno en staging/producción.** `SIGEF_WS_URL`, `SIGEF_APP_ID` (y opcionalmente `SIGEF_TIMEOUT_MS`) deben configurarse en el ambiente de destino — hoy solo están documentadas en `.env.example`, no confirmadas como cargadas fuera de local.
4. **URL de QA.** El WS todavía vive en el ambiente que compartió el proveedor; en cuanto confirmen la URL de QA, actualizar `SIGEF_WS_URL`.
5. **(Fuera de alcance, no bloqueante)** No existe una pantalla de administración para cargar `sigef_id_unidad` por Secretaría — se configura vía `PATCH /api/catalogo/centralizada/:id { sigef_id_unidad }`. Si se necesita una UI para esto, es trabajo adicional no incluido.

## Cómo configurar una nueva Secretaría

```
PATCH /api/catalogo/centralizada/:id
Body: { "sigef_id_unidad": 530 }
```

Donde `:id` es el UUID del nodo raíz (`parent_id = null`) de esa Secretaría en `organo_centralizado`.
