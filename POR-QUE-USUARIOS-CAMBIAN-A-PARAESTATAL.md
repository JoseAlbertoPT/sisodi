# Por qué los usuarios cambian de Centralizada a Paraestatal (sin que nadie los cambie) y cómo solucionarlo

## Resumen rápido

- **Nadie los cambió a mano.** El tipo de administración (Centralizada / Paraestatal) **no se guarda**: se **calcula** a partir del `secretaria_id` de cada usuario.
- En **cada despliegue** (al arrancar el contenedor) se ejecuta un *seed* que hace `UPDATE usuario SET secretaria_id = NULL` a **todos** los usuarios.
- Al quedar el `secretaria_id` en NULL, el sistema los calcula como **Paraestatal**.
- Efecto secundario: sus **solicitudes centralizadas dejan de aparecer** en "Mis Solicitudes" (no se borran, quedan ocultas por el filtro).

---

## 1) Por qué pasa (causa raíz)

El tipo se deriva así:

```
¿el secretaria_id del usuario apunta a un organo_centralizado?
   SÍ  -> Centralizada
   NO / NULL -> Paraestatal
```

La cadena que rompe el `secretaria_id` en cada deploy:

1. **`docker-entrypoint.sh`** (se ejecuta en cada arranque del contenedor):
   ```sh
   npx prisma migrate deploy
   npx tsx prisma/seed.ts        # <-- corre el seed COMPLETO en cada deploy
   ```

2. **`prisma/seed.ts`** llama a **`seedSecretarias()`**, que hacía:
   ```ts
   UPDATE usuario SET secretaria_id = NULL WHERE secretaria_id IS NOT NULL
   await prisma.organo_centralizado.deleteMany({})   // y recrea los órganos con IDs NUEVOS
   ```

Resultado: todos los usuarios quedan con `secretaria_id = NULL` -> todos se ven **Paraestatal**.

> Nota: el `secretaria_texto` (el nombre/clave de la secretaría) **NO se borró**, por eso los usuarios son **recuperables**.

---

## 2) Cómo comprobarlo (evidencia)

### a) En los logs del despliegue
Al arrancar el contenedor, busca este mensaje (es la prueba de que el seed borró los datos):
```
organo_centralizado limpiado
```

### b) En la base de datos (consultas de SOLO LECTURA, no modifican nada)
```sql
-- Cuántos usuarios quedaron sin secretaria_id (pero con texto = recuperables)
SELECT
  COUNT(*)                                              AS total_usuarios,
  COUNT(*) FILTER (WHERE secretaria_id IS NULL)         AS sin_secretaria_id,
  COUNT(*) FILTER (WHERE secretaria_id IS NULL
                   AND secretaria_texto IS NOT NULL)    AS recuperables_por_texto
FROM usuario;

-- Confirmar que los órganos existen (recreados con IDs nuevos)
SELECT COUNT(*) AS total_organos_centralizados FROM organo_centralizado;
```
Si `sin_secretaria_id` es casi el total y `recuperables_por_texto` es alto -> confirmado.

---

## 3) Cómo solucionarlo

### PARTE A — Que NO vuelva a pasar (prevención)

**A.1. Blindaje del seed (YA aplicado en el código).**
`prisma/seed/secretarias.ts` y `prisma/seed/paraestatales.ts` ahora se **omiten** si ya existen datos:
```ts
const yaHayOrganos = await prisma.organo_centralizado.count()
if (yaHayOrganos > 0) {
  console.log("organo_centralizado ya poblado — seed OMITIDO (evita borrar datos)")
  return
}
```
Con esto, el próximo deploy **ya no borra** el `secretaria_id`. **Es indispensable desplegar esta versión.**

**A.2. Recomendado: no correr el seed en cada arranque.**
Editar `docker-entrypoint.sh` para que solo aplique migraciones y NO ejecute el seed automáticamente:
```sh
#!/bin/sh
set -e

echo "==> Aplicando migraciones de Prisma..."
npx prisma migrate deploy

# El seed NO debe correr en cada arranque. Ejecutarlo manualmente solo
# la primera vez / en una base vacía:  npx tsx prisma/seed.ts

echo "==> Arrancando Next.js..."
exec node server.js
```

### PARTE B — Recuperar lo ya dañado (traer usuarios y solicitudes de vuelta)

El `secretaria_texto` se conservó, así que se puede reconstruir el `secretaria_id`. Opciones:

- **Opción 1 (la más exacta): restaurar un respaldo** de la base tomado **antes** del despliegue.
- **Opción 2: re-vincular `secretaria_id` desde `secretaria_texto`** (empatando el texto contra los órganos recreados). Se puede hacer con un script puntual o con un botón interno en la app (solo admin). *Pídeselo al desarrollador si eliges esta vía.*

> Al restaurar el `secretaria_id`, los usuarios vuelven a **Centralizada** y, automáticamente, **sus solicitudes vuelven a aparecer** (no hay que tocar la tabla de solicitudes).

---

## 4) Checklist para el próximo despliegue

1. [ ] Desplegar la versión con el **blindaje del seed** (Parte A.1).
2. [ ] Aplicar el cambio en **`docker-entrypoint.sh`** para que el seed no corra en cada arranque (Parte A.2).
3. [ ] Verificar en logs que aparezca `... seed de secretarías OMITIDO ...` (y ya **no** `organo_centralizado limpiado`).
4. [ ] Recuperar los datos actuales (Parte B): restaurar respaldo o re-vincular por texto.
5. [ ] Confirmar en la app que los usuarios vuelven a **Centralizada** y que reaparecen sus solicitudes.

---

**Regla de oro:** nunca ejecutar un *seed* destructivo (que borra/recrea tablas) sobre una base de datos con información real.
