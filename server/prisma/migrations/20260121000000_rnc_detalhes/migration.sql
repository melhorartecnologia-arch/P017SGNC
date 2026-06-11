-- Detalhes adicionais do RNC: disposição do material, origem da NC,
-- severidade aplicada e descrição livre do defeito.
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "disposicao_material_id" UUID,
  ADD COLUMN "origem_id" UUID,
  ADD COLUMN "severidade_id" UUID,
  ADD COLUMN "descricao_defeito" TEXT;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_disposicao_material_id_fkey"
  FOREIGN KEY ("disposicao_material_id") REFERENCES "disposicoes_material"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_origem_id_fkey"
  FOREIGN KEY ("origem_id") REFERENCES "origens_nao_conformidade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_severidade_id_fkey"
  FOREIGN KEY ("severidade_id") REFERENCES "severidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "relatorios_nao_conformidade_disposicao_material_id_idx"
  ON "relatorios_nao_conformidade"("disposicao_material_id");
CREATE INDEX "relatorios_nao_conformidade_origem_id_idx"
  ON "relatorios_nao_conformidade"("origem_id");
CREATE INDEX "relatorios_nao_conformidade_severidade_id_idx"
  ON "relatorios_nao_conformidade"("severidade_id");
