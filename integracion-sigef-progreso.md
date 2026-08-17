# Integración SIGeF (ControlProyectosServicio) — Estado actual

Objetivo: que el campo **"Programa o Proyecto"** del formulario Nueva Solicitud deje de depender de captura manual y se llene consultando el Web Service SOAP de SIGeF, filtrado por la Secretaría del usuario.

Última actualización de este documento: 2026-08-17.

## Resumen ejecutivo

| | Estado |
|---|---|
| Cliente SOAP (3 operaciones: `proyectos`, `dependencias`, `unidades`) | ✅ Implementado y probado contra el servicio real |
| Bug de comillas XML (`&quot;`) sin decodificar | ✅ Encontrado y corregido, verificado contra respuesta real |
| Endpoint interno + caché de 10 min | ✅ Implementado |
| Timeout ante servicio caído/no disponible | ✅ Implementado y probado contra una caída real del servicio |
| Aviso visible al usuario si SIGeF falla | ✅ Implementado y confirmado en pantalla (screenshot real) |
| Campo "Programa o Proyecto" en ambos formularios | ✅ Implementado, con fallback al comportamiento anterior |
| Mapeo Secretaría → SIGeF | ✅ **16 de 17 Secretarías configuradas** (backfill automático contra el catálogo real de SIGeF, 2026-08-17) |
| Prueba contra el WS real | ✅ Hecha — las 3 operaciones, con datos reales, incluyendo una caída real del servicio |

**En una frase:** la integración está funcionalmente completa y probada contra el servicio real (no solo mockeado). Lo único pendiente es operativo: que el servicio de SIGeF esté disponible de forma estable (hoy corre de forma intermitente desde la máquina del proveedor) y que confirmen la URL de QA.

## Cómo funciona (diseño actual)

`proyectos` de SIGeF solo acepta un **idUnidad** (una oficina/unidad específica), no un idDependencia. Se confirmó el 2026-08-17 que **cada unidad dentro de una misma Secretaría tiene su propio catálogo de proyectos, sin traslape** (ej. Oficina del Titular de Secretaría de Gobierno vs. Subsecretaría de Gobierno: cero proyectos en común). Por lo tanto:

1. El usuario abre Nueva Solicitud con su Secretaría ya conocida (`secretariaConfirmada`).
2. `useProgramasSigef` llama a `GET /api/sigef/proyectos?secretaria=<nombre>`.
3. La API busca el `sigef_id_dependencia` de esa Secretaría en `organo_centralizado`.
   - Si no está configurado → `{ configured: false }`, el formulario sigue con el catálogo local/captura manual (sin cambios).
4. Si está configurado, `consultarProyectosPorDependencia(idDependencia)`:
   - Llama a `unidades({appId, idDependencia})` → trae todas las unidades de esa Secretaría.
   - Llama a `proyectos({appId, idUnidad})` **en paralelo** para cada unidad (`Promise.allSettled`, tolera que algunas unidades fallen sin tumbar todo).
   - Une los resultados, deduplicados por clave de proyecto.
5. El resultado se cachea 10 minutos por `idDependencia` (evita repetir N llamadas SOAP en cada apertura del formulario — para la Secretaría con más unidades, 26, la primera consulta tarda ~4s).
6. El campo se vuelve un `SelectConBusqueda` de solo selección con esas opciones.

## Archivos

- **`lib/sigef-client.ts`** — cliente SOAP con 3 operaciones (`consultarProyectosSigef`, `consultarDependenciasSigef`, `consultarUnidadesSigef`) más `consultarProyectosPorDependencia` (la que arma la unión). Decodifica entidades XML (`&quot;`, `&amp;`, etc.) antes de parsear — el servicio real las usa, no manda comillas crudas como se asumió al inicio. Timeout vía `AbortSignal.timeout` (`SIGEF_TIMEOUT_MS`, default 10s).
- **`app/api/sigef/proyectos/route.ts`** — `GET ?secretaria=<nombre>`, resuelve `sigef_id_dependencia`, llama al cliente, cachea 10 min.
- **`prisma/schema.prisma`** + migraciones — `organo_centralizado.sigef_id_dependencia` (nullable). Originalmente se llamó `sigef_id_unidad` y guardaba un idUnidad; se renombró (migración `20260817130000_sigef_id_unidad_to_dependencia`) al descubrir que el diseño de "una sola unidad representa a toda la Secretaría" no era correcto.
- **`app/api/catalogo/centralizada/[id]/route.ts`** — `PATCH` acepta `sigef_id_dependencia`.
- **`components/pages/nueva-solicitud-page.tsx`** — hook `useProgramasSigef`, campo "Programa o Proyecto" en `FormularioPrestacion` y `FormularioNombramiento` con aviso visible si SIGeF falla.
- **`.env`** / **`.env.example`** — `SIGEF_WS_URL`, `SIGEF_APP_ID`, `SIGEF_TIMEOUT_MS`.

## Mapeo actual (backfill automático, 2026-08-17)

Se hizo matching por nombre entre las Secretarías de `organo_centralizado` y el catálogo `dependencias` de SIGeF (24 dependencias). Resultado: **16 de 17** quedaron configuradas automáticamente (todas menos "Prueba", que no es una secretaría real). Se puede reconfigurar cualquiera vía:

```
PATCH /api/catalogo/centralizada/:id
Body: { "sigef_id_dependencia": <idDependencia de SIGeF> }
```

## Pruebas realizadas contra el servicio real (no mockeadas)

1. `proyectos(530)` → 4 proyectos reales de "Jefatura de la Oficina de la Gubernatura del Estado".
2. `dependencias()` → 24 dependencias reales.
3. `unidades(idDependencia=37)` → 26 unidades reales, cada una con su `idUnidad`.
4. Unión completa para una Secretaría de 26 unidades → 50 proyectos únicos en ~4s.
5. **Caída real del servicio** (confirmada con `ping` exitoso + `curl` con "Connection refused" en el puerto 8080): el timeout y el aviso en pantalla funcionaron como se diseñó — confirmado con captura de pantalla real del formulario mostrando *"No se pudo cargar el catálogo de SIGeF, usando catálogo local. (No se pudo conectar con SIGeF: fetch failed)"*.

## Pendientes

1. **Disponibilidad del servicio.** El WS de SIGeF no corre en un servidor desplegado de forma estable — corre desde la máquina del proveedor (confirmado: compartieron la URL como `http://localhost:8080/...` en su propio chat) y se cae con frecuencia. Sin esto arriba, el formulario cae al catálogo local — funciona, pero no muestra datos reales de SIGeF.
2. **URL de QA.** En cuanto la confirmen, actualizar `SIGEF_WS_URL`.
3. **Variables de entorno en staging/producción.** `SIGEF_WS_URL`, `SIGEF_APP_ID`, `SIGEF_TIMEOUT_MS` deben configurarse ahí — hoy solo están confirmadas en local.
4. **"Secretaría Anticorrupción y Buen Gobierno"** quedó mapeada a la dependencia de SIGeF "Secretaría de la Contraloría / Secretaría Anticorrupción y Buen Gobierno" (coincidencia parcial de nombre, no exacta) — vale la pena que alguien confirme que es la correcta.
5. **(Fuera de alcance)** No hay pantalla de administración para editar `sigef_id_dependencia` — se hace vía `PATCH /api/catalogo/centralizada/:id`.
