-- CreateTable
CREATE TABLE IF NOT EXISTS "catalogo_justificacion" (
    "id"                        SERIAL NOT NULL,
    "solicitud_id"              INTEGER NOT NULL,
    "regimen_contratacion"      VARCHAR(50) NOT NULL,
    "programa_proyecto"         VARCHAR(500) NOT NULL,
    "tipo_actividad"            VARCHAR(200),
    "denominacion_nombramiento" VARCHAR(300),
    "puesto_jefe_inmediato"     VARCHAR(200),
    "numero_personas"           INTEGER,
    "tipo_pago"                 VARCHAR(50),
    "importe_bruto"             DECIMAL(14,2),
    "importe_neto"              DECIMAL(14,2),
    "vigencia"                  VARCHAR(200),
    "archivo_pdf_sin_firmas"    VARCHAR(500),
    "activo"                    BOOLEAN NOT NULL DEFAULT true,
    "creado_en"                 TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "actualizado_en"            TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "catalogo_justificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "catalogo_solicitud" (
    "id"                        SERIAL NOT NULL,
    "catalogo_justificacion_id" INTEGER NOT NULL,
    "usuario_id"                UUID NOT NULL,
    "nueva_vigencia"            VARCHAR(200) NOT NULL,
    "nuevo_numero_personas"     INTEGER,
    "nuevos_numero_prestadores" INTEGER,
    "archivo_pdf_generado"      VARCHAR(500),
    "procesado"                 BOOLEAN NOT NULL DEFAULT false,
    "procesado_en"              TIMESTAMP(6),
    "solicitud_nueva_id"        INTEGER,
    "creado_en"                 TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "catalogo_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "catalogo_justificacion_solicitud_id_key" ON "catalogo_justificacion"("solicitud_id");

-- AddForeignKey
ALTER TABLE "catalogo_justificacion"
    ADD CONSTRAINT "catalogo_justificacion_solicitud_id_fkey"
    FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "catalogo_solicitud"
    ADD CONSTRAINT "catalogo_solicitud_catalogo_justificacion_id_fkey"
    FOREIGN KEY ("catalogo_justificacion_id") REFERENCES "catalogo_justificacion"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "catalogo_solicitud"
    ADD CONSTRAINT "catalogo_solicitud_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
