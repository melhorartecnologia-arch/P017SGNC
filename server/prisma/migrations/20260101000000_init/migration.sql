-- CreateTable
CREATE TABLE "filiais" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "razao_social" VARCHAR(160) NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "insc_estadual" VARCHAR(20),
    "endereco" VARCHAR(200) NOT NULL,
    "numero" VARCHAR(20),
    "complemento" VARCHAR(60),
    "bairro" VARCHAR(80),
    "cidade" VARCHAR(80) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" VARCHAR(10) NOT NULL,
    "telefone" VARCHAR(20),
    "email" VARCHAR(160),
    "responsavel" VARCHAR(120),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filiais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "filiais_codigo_key" ON "filiais"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "filiais_cnpj_key" ON "filiais"("cnpj");

-- CreateIndex
CREATE INDEX "filiais_nome_idx" ON "filiais"("nome");

-- CreateIndex
CREATE INDEX "filiais_cidade_uf_idx" ON "filiais"("cidade", "uf");
