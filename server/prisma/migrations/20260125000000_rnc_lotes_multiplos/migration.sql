-- RNC: lote vira coleção. Cria a tabela "rnc_lotes" 1-N, migra o lote
-- existente (single string) para uma linha em rnc_lotes, e remove a
-- coluna "lote" da tabela de RNCs.
--
-- Fornecedor e Produto continuam controlados no DB: o fornecedor já é
-- NOT NULL desde a criação; o produto permanece nullable por compat.
-- com registros anteriores — a obrigatoriedade é enforced no schema da
-- API (Zod) e no Wizard.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Cria a tabela rnc_lotes.
CREATE TABLE "rnc_lotes" (
    "id"         UUID         NOT NULL,
    "rnc_id"     UUID         NOT NULL,
    "numero"     VARCHAR(80)  NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnc_lotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rnc_lotes_rnc_id_numero_key"
  ON "rnc_lotes"("rnc_id", "numero");
CREATE INDEX "rnc_lotes_rnc_id_idx"
  ON "rnc_lotes"("rnc_id");

ALTER TABLE "rnc_lotes"
  ADD CONSTRAINT "rnc_lotes_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Backfill: cada lote não-vazio existente vira uma linha em rnc_lotes.
INSERT INTO "rnc_lotes" ("id", "rnc_id", "numero", "created_at")
SELECT
  gen_random_uuid(),
  id,
  TRIM(lote),
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM "relatorios_nao_conformidade"
WHERE lote IS NOT NULL AND TRIM(lote) <> '';

-- 3) Remove a coluna antiga.
ALTER TABLE "relatorios_nao_conformidade" DROP COLUMN "lote";
