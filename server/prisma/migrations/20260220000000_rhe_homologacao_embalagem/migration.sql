-- RHE — Relatório de Homologação de Embalagem (FOR.IND.CQA.031). Mesmo
-- desenho do RAQ/RVT, com uma diferença: o representante técnico do
-- fornecedor ASSINA o documento (linha avulsa na matriz). Sem devolução.

-- Seguro na transação: o valor novo não é usado nesta migração.
ALTER TYPE "TipoDocumento" ADD VALUE IF NOT EXISTS 'RHE';

-- CreateEnum
CREATE TYPE "HomologacaoResultado" AS ENUM (
  'APROVADO', 'REPROVADO', 'APROVADO_COM_RESTRICAO'
);

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "tipo_produto_aplicacao" VARCHAR(200),
  ADD COLUMN "definicao_teste" TEXT,
  ADD COLUMN "linha_envase" VARCHAR(80),
  ADD COLUMN "fabricacao_texto" VARCHAR(200),
  ADD COLUMN "validade_texto" VARCHAR(100),
  ADD COLUMN "quantidade_texto" VARCHAR(100),
  ADD COLUMN "analisado_por" VARCHAR(200),
  ADD COLUMN "avaliacao_consideracoes" TEXT,
  ADD COLUMN "homologacao_inicial" "HomologacaoResultado",
  ADD COLUMN "homologacao_inicial_data" TIMESTAMP(3),
  ADD COLUMN "homologacao_final" "HomologacaoResultado",
  ADD COLUMN "homologacao_final_data" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "filiais" ADD COLUMN "rhe_numero_inicial" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rhe_representantes" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rhe_representantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rhe_representantes_rnc_id_idx" ON "rhe_representantes"("rnc_id");

-- AddForeignKey
ALTER TABLE "rhe_representantes"
  ADD CONSTRAINT "rhe_representantes_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
