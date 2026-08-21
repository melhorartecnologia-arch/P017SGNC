-- Ciência do fornecedor: após todas as assinaturas, o documento é enviado ao
-- contato do fornecedor, que pode aceitar ou recusar/questionar a RNC.
CREATE TYPE "CienciaFornecedorStatus" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA', 'ACEITA_POR_DECURSO');

ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "ciencia_status"        "CienciaFornecedorStatus",
  ADD COLUMN "ciencia_token"         VARCHAR(64),
  ADD COLUMN "ciencia_email"         VARCHAR(160),
  ADD COLUMN "ciencia_enviada_em"    TIMESTAMP(3),
  ADD COLUMN "ciencia_prazo_em"      TIMESTAMP(3),
  ADD COLUMN "ciencia_respondida_em" TIMESTAMP(3),
  ADD COLUMN "ciencia_respondida_por" VARCHAR(160),
  ADD COLUMN "ciencia_justificativa" TEXT,
  ADD COLUMN "ciencia_ip"            VARCHAR(64),
  ADD COLUMN "ciencia_navegador"     VARCHAR(160);

CREATE UNIQUE INDEX "relatorios_nao_conformidade_ciencia_token_key"
  ON "relatorios_nao_conformidade"("ciencia_token");
