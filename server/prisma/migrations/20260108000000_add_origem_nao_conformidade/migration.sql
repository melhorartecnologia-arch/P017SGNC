-- CreateTable
CREATE TABLE "origens_nao_conformidade" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "origens_nao_conformidade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "origens_nao_conformidade_codigo_key" ON "origens_nao_conformidade"("codigo");
CREATE INDEX "origens_nao_conformidade_nome_idx" ON "origens_nao_conformidade"("nome");
