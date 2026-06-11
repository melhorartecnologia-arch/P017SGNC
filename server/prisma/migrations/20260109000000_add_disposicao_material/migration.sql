-- CreateTable
CREATE TABLE "disposicoes_material" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposicoes_material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "disposicoes_material_codigo_key" ON "disposicoes_material"("codigo");
CREATE INDEX "disposicoes_material_descricao_idx" ON "disposicoes_material"("descricao");
