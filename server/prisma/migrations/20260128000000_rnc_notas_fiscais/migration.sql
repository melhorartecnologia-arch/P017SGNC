-- Nova tabela de notas fiscais por RNC (uma RNC pode ter várias notas).
CREATE TABLE "rnc_notas_fiscais" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "numero" VARCHAR(40),
    "data_fabricacao" TIMESTAMP(3),
    "data_validade" TIMESTAMP(3),
    "data_recebimento" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnc_notas_fiscais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rnc_notas_fiscais_rnc_id_idx" ON "rnc_notas_fiscais"("rnc_id");

ALTER TABLE "rnc_notas_fiscais"
  ADD CONSTRAINT "rnc_notas_fiscais_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Migra os dados das colunas antigas (campo único) para a nova tabela.
-- Cria uma nota para cada RNC que tinha número de NF OU alguma data.
INSERT INTO "rnc_notas_fiscais" (
    "id", "rnc_id", "numero", "data_fabricacao", "data_validade", "data_recebimento"
)
SELECT
    gen_random_uuid(),
    "id",
    "numero_nf",
    "data_fabricacao",
    "data_validade",
    "data_recebimento"
FROM "relatorios_nao_conformidade"
WHERE "numero_nf" IS NOT NULL
   OR "data_fabricacao" IS NOT NULL
   OR "data_validade" IS NOT NULL
   OR "data_recebimento" IS NOT NULL;

-- Remove as colunas antigas, agora substituídas pela tabela relacionada.
ALTER TABLE "relatorios_nao_conformidade"
  DROP COLUMN "numero_nf",
  DROP COLUMN "data_fabricacao",
  DROP COLUMN "data_validade",
  DROP COLUMN "data_recebimento";
