-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "unidade_medida" VARCHAR(10) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "produtos_codigo_key" ON "produtos"("codigo");
CREATE INDEX "produtos_descricao_idx" ON "produtos"("descricao");
