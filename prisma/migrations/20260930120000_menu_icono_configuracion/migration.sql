-- El ícono de cada menú vive en la columna menu.icono. El engrane de
-- "Configuración" (key 'calendario') solo lo pone el seed, que no corre en el
-- servidor (ver docker-entrypoint.sh), así que ahí se quedaba con el ícono
-- anterior. Se alinea con prisma/seed/menus.ts.
UPDATE menu SET icono = 'Settings' WHERE key = 'calendario';
