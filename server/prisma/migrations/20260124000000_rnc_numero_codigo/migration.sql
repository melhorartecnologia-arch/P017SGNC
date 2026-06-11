-- RNC: substitui o número sequencial inteiro pelo código no formato
-- <CodigoFilial><MM><AA><SEQ3>, onde MM/AA vêm da data de identificação e
-- SEQ3 é o sequencial dentro de (filial, ano), zero-padded a 3 dígitos.

-- 1) Remove a unique constraint do número inteiro atual.
ALTER TABLE "relatorios_nao_conformidade"
  DROP CONSTRAINT IF EXISTS "relatorios_nao_conformidade_numero_key";

-- 2) Cria a nova coluna como texto, inicialmente NULL para permitir backfill.
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "numero_new" VARCHAR(40);

-- 3) Backfill: para cada RNC existente, monta CODFILIAL+MM+AA+SEQ usando
--    ROW_NUMBER() particionado por (filial, ano da data de identificação),
--    preservando a ordem original do número inteiro.
WITH numbered AS (
  SELECT
    rnc.id,
    UPPER(TRIM(f.codigo))                                  AS filial_codigo,
    TO_CHAR(rnc.data_identificacao, 'MM')                  AS mm,
    TO_CHAR(rnc.data_identificacao, 'YY')                  AS yy,
    ROW_NUMBER() OVER (
      PARTITION BY rnc.filial_id, EXTRACT(YEAR FROM rnc.data_identificacao)
      ORDER BY rnc.numero
    ) AS seq
  FROM "relatorios_nao_conformidade" rnc
  JOIN "filiais" f ON f.id = rnc.filial_id
)
UPDATE "relatorios_nao_conformidade" rnc
SET "numero_new" =
      numbered.filial_codigo || numbered.mm || numbered.yy ||
      LPAD(numbered.seq::text, 3, '0')
FROM numbered
WHERE rnc.id = numbered.id;

-- 4) Substitui a coluna antiga pela nova.
ALTER TABLE "relatorios_nao_conformidade" DROP COLUMN "numero";
ALTER TABLE "relatorios_nao_conformidade" RENAME COLUMN "numero_new" TO "numero";

-- 5) NOT NULL + unique no novo formato.
ALTER TABLE "relatorios_nao_conformidade" ALTER COLUMN "numero" SET NOT NULL;
ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_numero_key" UNIQUE ("numero");

-- 6) Limpa a sequence criada pelo antigo SERIAL.
DROP SEQUENCE IF EXISTS "relatorios_nao_conformidade_numero_seq";
