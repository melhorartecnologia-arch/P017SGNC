-- Tipo de Não Conformidade ganha um vínculo opcional com a severidade
-- típica do defeito.
ALTER TABLE "tipos_nao_conformidade" ADD COLUMN "severidade_id" UUID;

ALTER TABLE "tipos_nao_conformidade"
  ADD CONSTRAINT "tipos_nao_conformidade_severidade_id_fkey"
  FOREIGN KEY ("severidade_id") REFERENCES "severidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tipos_nao_conformidade_severidade_id_idx"
  ON "tipos_nao_conformidade"("severidade_id");
