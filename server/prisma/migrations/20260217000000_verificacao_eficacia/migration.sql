-- Verificação de eficácia do plano de ação, registrada pelo aprovador
-- marcado depois da última data planejada mais o tempo de espera.

-- CreateEnum
CREATE TYPE "EficaciaStatus" AS ENUM (
  'AGUARDANDO_PRAZO', 'PENDENTE', 'EFICAZ', 'NAO_EFICAZ'
);

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "eficacia_status" "EficaciaStatus",
  ADD COLUMN "eficacia_aberta_em" TIMESTAMP(3),
  ADD COLUMN "eficacia_data_base" TIMESTAMP(3),
  ADD COLUMN "eficacia_liberada_em" TIMESTAMP(3),
  ADD COLUMN "eficacia_avisada_em" TIMESTAMP(3),
  ADD COLUMN "eficacia_verificada_em" TIMESTAMP(3),
  ADD COLUMN "eficacia_verificada_por" VARCHAR(160),
  ADD COLUMN "eficacia_parecer" TEXT;

-- AlterTable
ALTER TABLE "configuracoes_workflow"
  ADD COLUMN "eficacia_espera_dias" INTEGER NOT NULL DEFAULT 30;
