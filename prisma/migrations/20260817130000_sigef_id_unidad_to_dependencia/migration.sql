-- El diseño cambió: "Programa o Proyecto" ahora se arma uniendo los proyectos
-- de TODAS las unidades de una Dependencia de SIGeF (cada unidad trae proyectos
-- distintos), no de una sola unidad "raíz". Por eso el campo pasa de guardar un
-- idUnidad a guardar un idDependencia.
ALTER TABLE "organo_centralizado" RENAME COLUMN "sigef_id_unidad" TO "sigef_id_dependencia";
