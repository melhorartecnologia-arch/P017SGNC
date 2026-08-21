-- Ações de contingência deixam de ser um texto livre e passam a ser
-- cadastradas uma a uma, cada uma aprovada ou recusada pelo aprovador.

-- CreateEnum
CREATE TYPE "AcaoContingenciaStatus" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- CreateTable
CREATE TABLE "rnc_acoes_contingencia" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" VARCHAR(160),
    "prazo" TIMESTAMP(3),
    "status" "AcaoContingenciaStatus" NOT NULL DEFAULT 'PENDENTE',
    "informada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "informada_por" VARCHAR(160),
    "analisada_em" TIMESTAMP(3),
    "analisada_por" VARCHAR(160),
    "parecer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rnc_acoes_contingencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rnc_acoes_contingencia_rnc_id_idx" ON "rnc_acoes_contingencia"("rnc_id");
CREATE INDEX "rnc_acoes_contingencia_status_idx" ON "rnc_acoes_contingencia"("status");

-- AddForeignKey
ALTER TABLE "rnc_acoes_contingencia"
  ADD CONSTRAINT "rnc_acoes_contingencia_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserva as devolutivas já registradas em texto livre: cada uma vira
-- uma ação única do plano, mantendo autor e data originais.
INSERT INTO "rnc_acoes_contingencia" (
  "id", "rnc_id", "ordem", "descricao", "status",
  "informada_em", "informada_por", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  "id",
  1,
  "contingencia_acoes",
  'PENDENTE'::"AcaoContingenciaStatus",
  COALESCE("contingencia_respondida_em", CURRENT_TIMESTAMP),
  "contingencia_respondida_por",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "relatorios_nao_conformidade"
WHERE "contingencia_acoes" IS NOT NULL
  AND btrim("contingencia_acoes") <> '';

-- O texto livre não é mais a fonte da verdade.
ALTER TABLE "relatorios_nao_conformidade" DROP COLUMN "contingencia_acoes";

-- Novos estados do plano: enviado (EM_ANALISE), aprovado (APROVADA) ou
-- devolvido para correção (AJUSTE_SOLICITADO). RESPONDIDA sai de cena e
-- vira EM_ANALISE — plano entregue, análise pendente.
-- O enum é recriado (e não estendido com ADD VALUE) porque um valor novo
-- não pode ser usado na mesma transação em que é criado.
ALTER TYPE "ContingenciaStatus" RENAME TO "ContingenciaStatus_old";

CREATE TYPE "ContingenciaStatus" AS ENUM (
  'PENDENTE', 'EM_ANALISE', 'APROVADA', 'AJUSTE_SOLICITADO'
);

ALTER TABLE "relatorios_nao_conformidade"
  ALTER COLUMN "contingencia_status" TYPE "ContingenciaStatus"
  USING (
    CASE "contingencia_status"::text
      WHEN 'RESPONDIDA' THEN 'EM_ANALISE'
      ELSE "contingencia_status"::text
    END
  )::"ContingenciaStatus";

DROP TYPE "ContingenciaStatus_old";

-- Registro da análise do plano (quem concluiu a avaliação e quando).
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "contingencia_analisada_em" TIMESTAMP(3),
  ADD COLUMN "contingencia_analisada_por" VARCHAR(160);
