-- Usuário ganha um vínculo opcional com sua filial padrão.
ALTER TABLE "usuarios" ADD COLUMN "filial_padrao_id" UUID;

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_filial_padrao_id_fkey"
  FOREIGN KEY ("filial_padrao_id") REFERENCES "filiais"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "usuarios_filial_padrao_id_idx" ON "usuarios"("filial_padrao_id");
