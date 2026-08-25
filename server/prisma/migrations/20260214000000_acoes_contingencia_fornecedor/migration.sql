-- Ações de contingência do fornecedor + parâmetros dos workflows.

-- CreateEnum
CREATE TYPE "ContingenciaStatus" AS ENUM ('PENDENTE', 'RESPONDIDA');

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "contingencia_status" "ContingenciaStatus",
  ADD COLUMN "contingencia_solicitada_em" TIMESTAMP(3),
  ADD COLUMN "contingencia_prazo_em" TIMESTAMP(3),
  ADD COLUMN "contingencia_respondida_em" TIMESTAMP(3),
  ADD COLUMN "contingencia_respondida_por" VARCHAR(160),
  ADD COLUMN "contingencia_acoes" TEXT,
  ADD COLUMN "contingencia_ip" VARCHAR(64),
  ADD COLUMN "contingencia_navegador" VARCHAR(160),
  ADD COLUMN "contingencia_ultimo_alerta" TIMESTAMP(3),
  ADD COLUMN "contingencia_alertas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "configuracoes_workflow" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ciencia_prazo_horas" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "contingencia_prazo_horas" DOUBLE PRECISION NOT NULL DEFAULT 72,
    "contingencia_alertas_por_dia" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_workflow_pkey" PRIMARY KEY ("id")
);

-- Linha única com os padrões, para a tela de parâmetros já abrir preenchida.
INSERT INTO "configuracoes_workflow" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;
