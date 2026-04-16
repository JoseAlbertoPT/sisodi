-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "accion" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "accion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "ruta" TEXT NOT NULL,
    "tipo" VARCHAR(100),
    "fecha_subida" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "etapa" VARCHAR(10),

    CONSTRAINT "checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_detalle" (
    "id" SERIAL NOT NULL,
    "checklist_id" INTEGER NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cumplido" BOOLEAN DEFAULT false,

    CONSTRAINT "checklist_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consecutivo_folio" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50),
    "mes" INTEGER,
    "anio" INTEGER,
    "consecutivo" INTEGER DEFAULT 1,

    CONSTRAINT "consecutivo_folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictamen" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "folio" VARCHAR(50) NOT NULL,
    "fecha_emision" TIMESTAMP(6) NOT NULL,
    "tipo_firma" VARCHAR(20),
    "archivo_pdf" TEXT,

    CONSTRAINT "dictamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_solicitud" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado_anterior_id" INTEGER,
    "estado_nuevo_id" INTEGER NOT NULL,
    "comentario" TEXT,
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "ruta" VARCHAR(200),
    "orden" INTEGER DEFAULT 0,
    "activo" BOOLEAN DEFAULT true,
    "icono" VARCHAR(50),
    "key" VARCHAR(50),
    "parent_id" INTEGER,

    CONSTRAINT "menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_menu" (
    "id" SERIAL NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,

    CONSTRAINT "rol_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_menu_accion" (
    "id" SERIAL NOT NULL,
    "rol_menu_id" INTEGER NOT NULL,
    "accion_id" INTEGER NOT NULL,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "rol_menu_accion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado_id" INTEGER NOT NULL,
    "periodo_id" INTEGER NOT NULL,
    "tipo_solicitud" VARCHAR(100) NOT NULL,
    "es_extemporanea" BOOLEAN DEFAULT false,
    "folio_recepcion" VARCHAR(50),
    "folio_dictamen" VARCHAR(50),
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_envio" TIMESTAMP(6),
    "fecha_emision" TIMESTAMP(6),
    "folio_justificacion" VARCHAR(50),
    "secretaria" VARCHAR(200),
    "unidad_administrativa" VARCHAR(200),
    "unidad_responsable" VARCHAR(200),
    "programa_proyecto" VARCHAR(200),
    "regimen" VARCHAR(100),
    "tipo_actividades" VARCHAR(200),
    "numero_prestadores" INTEGER,
    "denominacion" VARCHAR(200),
    "vigencia_inicio" DATE,
    "vigencia_fin" DATE,
    "importe_bruto" DECIMAL(14,2),
    "es_renovacion" BOOLEAN DEFAULT false,
    "folio_anterior" VARCHAR(50),
    "nivel_tabulador" VARCHAR(20),
    "categoria_tabulador" VARCHAR(10),
    "objeto" TEXT,
    "actividades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responsabilidades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escolaridad" VARCHAR(100),
    "comp_adm" TEXT,
    "comp_tec" TEXT,
    "comp_soc" TEXT,
    "valores" TEXT,
    "areas_exp" TEXT,
    "revisor_asignado_id" UUID,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" VARCHAR(150) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "area_id" INTEGER,
    "activo" BOOLEAN DEFAULT true,
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "rfc" VARCHAR(13),
    "must_change_password" BOOLEAN DEFAULT false,
    "secretaria_id" UUID,
    "secretaria_texto" VARCHAR(512),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_recuperacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "codigo" VARCHAR(6) NOT NULL,
    "expira_en" TIMESTAMP(6) NOT NULL,
    "usado" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre_archivo" VARCHAR(512) NOT NULL,
    "subido_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sheet_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sheets" JSONB NOT NULL DEFAULT '{}',
    "nombre_archivo2" VARCHAR(512),
    "sheet_names2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sheets2" JSONB DEFAULT '{}',

    CONSTRAINT "PK_0fad738d5b2a11ac448686db608" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario" (
    "id" SERIAL NOT NULL,
    "ejercicio" INTEGER NOT NULL,
    "limite_dgrh" VARCHAR(20) NOT NULL,
    "limite_do" VARCHAR(20) NOT NULL,
    "periodo" VARCHAR(50) NOT NULL,
    "regimen" VARCHAR(20) NOT NULL,

    CONSTRAINT "calendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organo_centralizado" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nombre" VARCHAR(512) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "tipo" VARCHAR(64),
    "parent_id" UUID,
    "clave_reporte_plazas" VARCHAR(100),
    "ua_clave_administrativa" VARCHAR(512),

    CONSTRAINT "organo_centralizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_paraestatal" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categoria_paraestatal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organo_paraestatal" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(512) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "categoria_id" INTEGER NOT NULL,
    "clave_reporte_plazas" VARCHAR(100),
    "ua_clave_administrativa" VARCHAR(512),

    CONSTRAINT "organo_paraestatal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_captura" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "regimen" VARCHAR(20) NOT NULL,
    "periodo" VARCHAR(50) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "granted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" VARCHAR(150) NOT NULL,
    "consumed_at" TIMESTAMP(6),

    CONSTRAINT "permiso_captura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consecutivo_folio_tipo_mes_anio_key" ON "consecutivo_folio"("tipo", "mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "dictamen_solicitud_id_key" ON "dictamen"("solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX "estado_nombre_key" ON "estado"("nombre");

-- CreateIndex
CREATE INDEX "idx_historial_solicitud" ON "historial_solicitud"("solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_mes_anio_key" ON "periodo"("mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_menu_rol_id_menu_id_key" ON "rol_menu"("rol_id", "menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_menu_accion_rol_menu_id_accion_id_key" ON "rol_menu_accion"("rol_menu_id", "accion_id");

-- CreateIndex
CREATE INDEX "idx_solicitud_estado" ON "solicitud"("estado_id");

-- CreateIndex
CREATE INDEX "idx_solicitud_usuario" ON "solicitud"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_rfc_key" ON "usuario"("rfc");

-- CreateIndex
CREATE INDEX "idx_usuario_rol" ON "usuario"("rol_id");

-- CreateIndex
CREATE INDEX "idx_usuario_rfc" ON "usuario"("rfc");

-- CreateIndex
CREATE UNIQUE INDEX "codigo_recuperacion_usuario_id_key" ON "codigo_recuperacion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_ejercicio_regimen_periodo_key" ON "calendario"("ejercicio", "regimen", "periodo");

-- AddForeignKey
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "checklist_detalle" ADD CONSTRAINT "checklist_detalle_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklist"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "checklist_detalle" ADD CONSTRAINT "checklist_detalle_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dictamen" ADD CONSTRAINT "dictamen_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_estado_anterior_id_fkey" FOREIGN KEY ("estado_anterior_id") REFERENCES "estado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_estado_nuevo_id_fkey" FOREIGN KEY ("estado_nuevo_id") REFERENCES "estado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "menu" ADD CONSTRAINT "menu_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_menu" ADD CONSTRAINT "rol_menu_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_menu" ADD CONSTRAINT "rol_menu_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_menu_accion" ADD CONSTRAINT "rol_menu_accion_accion_id_fkey" FOREIGN KEY ("accion_id") REFERENCES "accion"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_menu_accion" ADD CONSTRAINT "rol_menu_accion_rol_menu_id_fkey" FOREIGN KEY ("rol_menu_id") REFERENCES "rol_menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_revisor_asignado_id_fkey" FOREIGN KEY ("revisor_asignado_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_secretaria_id_fkey" FOREIGN KEY ("secretaria_id") REFERENCES "organo_centralizado"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organo_centralizado" ADD CONSTRAINT "organo_centralizado_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organo_centralizado"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organo_paraestatal" ADD CONSTRAINT "organo_paraestatal_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_paraestatal"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permiso_captura" ADD CONSTRAINT "permiso_captura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
