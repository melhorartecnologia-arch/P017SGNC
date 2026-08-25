-- Numeração sequencial de RNC por filial, com ponto de partida configurável.

-- Ponto de partida da numeração por filial (último número do controle atual).
ALTER TABLE "filiais" ADD COLUMN "rnc_numero_inicial" INTEGER NOT NULL DEFAULT 0;

-- Sequência contínua da RNC dentro da filial.
ALTER TABLE "relatorios_nao_conformidade" ADD COLUMN "sequencial_filial" INTEGER;

-- Backfill: numera as RNCs já existentes por filial, na ordem de criação.
WITH ordenado AS (
  SELECT id,
         row_number() OVER (PARTITION BY "filial_id" ORDER BY "created_at", "numero") AS seq
  FROM "relatorios_nao_conformidade"
)
UPDATE "relatorios_nao_conformidade" r
SET "sequencial_filial" = o.seq
FROM ordenado o
WHERE r.id = o.id;
