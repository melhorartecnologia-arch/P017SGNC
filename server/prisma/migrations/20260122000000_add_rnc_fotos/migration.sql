-- Fotos anexadas a um RNC. Os arquivos físicos ficam em
-- server/uploads/rnc-fotos/{filename}.
CREATE TABLE "rnc_fotos" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "filename" VARCHAR(120) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(80) NOT NULL,
    "size" INTEGER NOT NULL,
    "legenda" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnc_fotos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rnc_fotos_rnc_id_idx" ON "rnc_fotos"("rnc_id");

ALTER TABLE "rnc_fotos"
  ADD CONSTRAINT "rnc_fotos_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
