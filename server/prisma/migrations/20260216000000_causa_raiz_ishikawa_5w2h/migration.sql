-- Análise de causa: diagrama de Ishikawa (6M) + 5W2H preenchidos pelo
-- fornecedor na plataforma e aprovados pelo aprovador marcado.

-- CreateEnum
CREATE TYPE "CausaRaizStatus" AS ENUM (
  'PENDENTE', 'EM_ANALISE', 'APROVADA', 'AJUSTE_SOLICITADO'
);

-- CreateEnum
CREATE TYPE "IshikawaCategoria" AS ENUM (
  'METODO', 'MAQUINA', 'MAO_DE_OBRA', 'MATERIAL', 'MEDICAO', 'MEIO_AMBIENTE'
);

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "causa_raiz_status" "CausaRaizStatus",
  ADD COLUMN "causa_raiz_solicitada_em" TIMESTAMP(3),
  ADD COLUMN "causa_raiz_enviada_em" TIMESTAMP(3),
  ADD COLUMN "causa_raiz_enviada_por" VARCHAR(160),
  ADD COLUMN "causa_raiz_analisada_em" TIMESTAMP(3),
  ADD COLUMN "causa_raiz_analisada_por" VARCHAR(160),
  ADD COLUMN "causa_raiz_parecer" TEXT,
  ADD COLUMN "causa_raiz_ip" VARCHAR(64),
  ADD COLUMN "causa_raiz_navegador" VARCHAR(160),
  ADD COLUMN "causa_raiz_envios" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "causa_o_que" TEXT,
  ADD COLUMN "causa_por_que" TEXT,
  ADD COLUMN "causa_onde" TEXT,
  ADD COLUMN "causa_quando" TEXT,
  ADD COLUMN "causa_quem" TEXT,
  ADD COLUMN "causa_como" TEXT,
  ADD COLUMN "causa_quanto_custa" TEXT;

-- CreateTable
CREATE TABLE "rnc_ishikawa_causas" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "categoria" "IshikawaCategoria" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rnc_ishikawa_causas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rnc_ishikawa_causas_rnc_id_idx" ON "rnc_ishikawa_causas"("rnc_id");

-- AddForeignKey
ALTER TABLE "rnc_ishikawa_causas"
  ADD CONSTRAINT "rnc_ishikawa_causas_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RNCs que já enviaram as ações de contingência entram na nova etapa:
-- a análise de causa é devida a partir do envio do plano.
UPDATE "relatorios_nao_conformidade"
SET "causa_raiz_status" = 'PENDENTE'::"CausaRaizStatus",
    "causa_raiz_solicitada_em" = COALESCE("contingencia_respondida_em", CURRENT_TIMESTAMP)
WHERE "contingencia_status" IN ('EM_ANALISE', 'APROVADA', 'AJUSTE_SOLICITADO')
  AND "causa_raiz_status" IS NULL;
