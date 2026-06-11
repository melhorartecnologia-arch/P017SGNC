-- CreateTable
CREATE TABLE "tipos_relatorio" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_relatorio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_relatorio_codigo_key" ON "tipos_relatorio"("codigo");
CREATE INDEX "tipos_relatorio_descricao_idx" ON "tipos_relatorio"("descricao");
