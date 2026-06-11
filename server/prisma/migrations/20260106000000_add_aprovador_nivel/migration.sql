-- Adiciona nivel (escalonamento de aprovação) ao aprovador.
ALTER TABLE "aprovadores" ADD COLUMN "nivel" INTEGER NOT NULL DEFAULT 1;

-- Para registros existentes, atribui nivel distinto por (filial, área) seguindo a ordem de criação.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY filial_id, area_id ORDER BY created_at) AS rn
  FROM "aprovadores"
)
UPDATE "aprovadores"
SET    nivel = ranked.rn
FROM   ranked
WHERE  "aprovadores".id = ranked.id;

ALTER TABLE "aprovadores" ALTER COLUMN "nivel" DROP DEFAULT;

-- Unicidade: um aprovador por nivel para cada (filial, área).
CREATE UNIQUE INDEX "aprovadores_filial_id_area_id_nivel_key"
  ON "aprovadores"("filial_id", "area_id", "nivel");
