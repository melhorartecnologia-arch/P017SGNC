-- CreateTable
CREATE TABLE "tipos_nao_conformidade" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_nao_conformidade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_nao_conformidade_codigo_key" ON "tipos_nao_conformidade"("codigo");
CREATE INDEX "tipos_nao_conformidade_descricao_idx" ON "tipos_nao_conformidade"("descricao");

-- Tabela de junção (M:N implícito do Prisma) entre Produto e TipoNaoConformidade.
CREATE TABLE "_ProdutoToTipoNaoConformidade" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_ProdutoToTipoNaoConformidade_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_ProdutoToTipoNaoConformidade_B_index" ON "_ProdutoToTipoNaoConformidade"("B");
ALTER TABLE "_ProdutoToTipoNaoConformidade"
  ADD CONSTRAINT "_ProdutoToTipoNaoConformidade_A_fkey"
  FOREIGN KEY ("A") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProdutoToTipoNaoConformidade"
  ADD CONSTRAINT "_ProdutoToTipoNaoConformidade_B_fkey"
  FOREIGN KEY ("B") REFERENCES "tipos_nao_conformidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
