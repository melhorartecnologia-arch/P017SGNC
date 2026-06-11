-- CreateEnum
CREATE TYPE "ContatoTipo" AS ENUM ('TELEFONE_FIXO', 'WHATSAPP', 'EMAIL');

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "razao_social" VARCHAR(160) NOT NULL,
    "nome_fantasia" VARCHAR(160),
    "cnpj" VARCHAR(18) NOT NULL,
    "endereco" VARCHAR(200) NOT NULL,
    "numero" VARCHAR(20),
    "complemento" VARCHAR(60),
    "bairro" VARCHAR(80),
    "cidade" VARCHAR(80) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" VARCHAR(10) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos_fornecedor" (
    "id" UUID NOT NULL,
    "fornecedor_id" UUID NOT NULL,
    "tipo" "ContatoTipo" NOT NULL,
    "valor" VARCHAR(160) NOT NULL,
    "nome" VARCHAR(120),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_codigo_key" ON "fornecedores"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cnpj_key" ON "fornecedores"("cnpj");

-- CreateIndex
CREATE INDEX "fornecedores_razao_social_idx" ON "fornecedores"("razao_social");

-- CreateIndex
CREATE INDEX "fornecedores_cidade_uf_idx" ON "fornecedores"("cidade", "uf");

-- CreateIndex
CREATE INDEX "contatos_fornecedor_fornecedor_id_idx" ON "contatos_fornecedor"("fornecedor_id");

-- CreateIndex
CREATE INDEX "contatos_fornecedor_fornecedor_id_tipo_idx" ON "contatos_fornecedor"("fornecedor_id", "tipo");

-- AddForeignKey
ALTER TABLE "contatos_fornecedor" ADD CONSTRAINT "contatos_fornecedor_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
