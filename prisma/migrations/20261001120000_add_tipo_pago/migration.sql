-- Catálogo de tipos de pago (Configuración > Tipos de pago). Se precarga con
-- los que estaban fijos en Nueva Solicitud, con las mismas claves que ya
-- existen en solicitud.tipo_importe.
CREATE TABLE "tipo_pago" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "usa_tabulador" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_pago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipo_pago_clave_key" ON "tipo_pago"("clave");

INSERT INTO "tipo_pago" ("clave", "nombre", "usa_tabulador", "orden") VALUES
    ('Mensual',    'Mensual',    true,  1),
    ('Unico',      'Único',      true,  2),
    ('Por_hora',   'Por Hora',   false, 3),
    ('Por_taller', 'Por Taller', false, 4),
    ('Por_dia',    'Por Día',    false, 5);
