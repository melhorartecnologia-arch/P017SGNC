-- CreateTable: areas
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "areas_codigo_key" ON "areas"("codigo");
CREATE INDEX "areas_nome_idx" ON "areas"("nome");

-- CreateTable: aprovadores
CREATE TABLE "aprovadores" (
    "id" UUID NOT NULL,
    "filial_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cargo" VARCHAR(120),
    "email" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aprovadores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "aprovadores_filial_id_idx" ON "aprovadores"("filial_id");
CREATE INDEX "aprovadores_area_id_idx" ON "aprovadores"("area_id");
CREATE INDEX "aprovadores_filial_id_area_id_idx" ON "aprovadores"("filial_id", "area_id");

ALTER TABLE "aprovadores"
  ADD CONSTRAINT "aprovadores_filial_id_fkey"
  FOREIGN KEY ("filial_id") REFERENCES "filiais"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "aprovadores"
  ADD CONSTRAINT "aprovadores_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "areas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
