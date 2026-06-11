-- A quantidade do lote deixa de ser um campo único da RNC e passa a
-- pertencer a cada linha de rnc_lotes. A quantidade com defeito
-- continua no nível da RNC (total). Backfill: cada lote existente
-- herda a quantidade_lote da RNC mãe (1 RNC = 1 lote no histórico).

-- 1) Adiciona quantidade na tabela de lotes.
ALTER TABLE "rnc_lotes"
  ADD COLUMN "quantidade" DOUBLE PRECISION;

-- 2) Backfill: copia quantidade_lote da RNC para cada um de seus lotes.
UPDATE "rnc_lotes" rl
SET "quantidade" = rnc."quantidade_lote"
FROM "relatorios_nao_conformidade" rnc
WHERE rl."rnc_id" = rnc."id"
  AND rnc."quantidade_lote" IS NOT NULL;

-- 3) Remove o campo antigo da RNC.
ALTER TABLE "relatorios_nao_conformidade" DROP COLUMN "quantidade_lote";
