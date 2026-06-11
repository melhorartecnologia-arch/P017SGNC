-- CreateEnum
CREATE TYPE "RncStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "relatorios_nao_conformidade" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "filial_id" UUID NOT NULL,
    "fornecedor_id" UUID NOT NULL,
    "tipo_nao_conformidade_id" UUID NOT NULL,
    "turno_id" UUID,
    "data_identificacao" TIMESTAMP(3) NOT NULL,
    "status" "RncStatus" NOT NULL DEFAULT 'DRAFT',
    "criado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relatorios_nao_conformidade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "relatorios_nao_conformidade_numero_key"
  ON "relatorios_nao_conformidade"("numero");
CREATE INDEX "relatorios_nao_conformidade_filial_id_idx"
  ON "relatorios_nao_conformidade"("filial_id");
CREATE INDEX "relatorios_nao_conformidade_fornecedor_id_idx"
  ON "relatorios_nao_conformidade"("fornecedor_id");
CREATE INDEX "relatorios_nao_conformidade_tipo_nao_conformidade_id_idx"
  ON "relatorios_nao_conformidade"("tipo_nao_conformidade_id");
CREATE INDEX "relatorios_nao_conformidade_status_idx"
  ON "relatorios_nao_conformidade"("status");

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_filial_id_fkey"
  FOREIGN KEY ("filial_id") REFERENCES "filiais"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_fornecedor_id_fkey"
  FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_tipo_nao_conformidade_id_fkey"
  FOREIGN KEY ("tipo_nao_conformidade_id") REFERENCES "tipos_nao_conformidade"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_turno_id_fkey"
  FOREIGN KEY ("turno_id") REFERENCES "turnos_trabalho"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
