-- Análise da recusa: o fornecedor recusa uma única vez; o aprovador marcado
-- acata a recusa ou a nega, tornando a RNC definitiva.
ALTER TYPE "CienciaFornecedorStatus" ADD VALUE IF NOT EXISTS 'RECUSA_ACEITA';
ALTER TYPE "CienciaFornecedorStatus" ADD VALUE IF NOT EXISTS 'MANTIDA_DEFINITIVA';

ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "ciencia_analise_token"         VARCHAR(64),
  ADD COLUMN "ciencia_analise_em"            TIMESTAMP(3),
  ADD COLUMN "ciencia_analise_por"           VARCHAR(160),
  ADD COLUMN "ciencia_analise_justificativa" TEXT,
  ADD COLUMN "ciencia_definitiva_em"         TIMESTAMP(3);

CREATE UNIQUE INDEX "relatorios_nao_conformidade_ciencia_analise_token_key"
  ON "relatorios_nao_conformidade"("ciencia_analise_token");
