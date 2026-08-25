-- Matriz de aprovação por RNC: uma pessoa por área (cadastro de
-- Aprovadores da filial), respeitando a restrição de turno quando houver.
CREATE TABLE "rnc_aprovadores" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "aprovador_id" UUID,
    "area_id" UUID,
    "area_nome" VARCHAR(120) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cargo" VARCHAR(120),
    "email" VARCHAR(160),
    "nivel" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnc_aprovadores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rnc_aprovadores_rnc_id_idx" ON "rnc_aprovadores"("rnc_id");

ALTER TABLE "rnc_aprovadores"
  ADD CONSTRAINT "rnc_aprovadores_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rnc_aprovadores"
  ADD CONSTRAINT "rnc_aprovadores_aprovador_id_fkey"
  FOREIGN KEY ("aprovador_id") REFERENCES "aprovadores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rnc_aprovadores"
  ADD CONSTRAINT "rnc_aprovadores_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "areas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
