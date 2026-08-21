-- RVT — Relatório de Visita Técnica. Mesmo desenho do RAQ: compartilha a
-- tabela e o workflow de assinatura da RNC via tipo_documento, e o fluxo
-- termina com as assinaturas e o envio do PDF ao fornecedor.

-- O valor novo só é usado em transações futuras, então o ADD VALUE é
-- seguro dentro da transação da migração.
ALTER TYPE "TipoDocumento" ADD VALUE IF NOT EXISTS 'RVT';

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "pauta" VARCHAR(200),
  ADD COLUMN "assuntos_abordados" TEXT,
  ADD COLUMN "conclusao" TEXT;

-- AlterTable
ALTER TABLE "filiais" ADD COLUMN "rvt_numero_inicial" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rvt_participantes" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rvt_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rvt_participantes_rnc_id_idx" ON "rvt_participantes"("rnc_id");

-- AddForeignKey
ALTER TABLE "rvt_participantes"
  ADD CONSTRAINT "rvt_participantes_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
