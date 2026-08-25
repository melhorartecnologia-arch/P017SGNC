-- Origem do cadastro: integrado do ERP Protheus (ETL) ou criado na plataforma.
CREATE TYPE "OrigemCadastro" AS ENUM ('PROTHEUS', 'PLATAFORMA');

ALTER TABLE "produtos"
  ADD COLUMN "origem_cadastro" "OrigemCadastro" NOT NULL DEFAULT 'PLATAFORMA';

ALTER TABLE "fornecedores"
  ADD COLUMN "origem_cadastro" "OrigemCadastro" NOT NULL DEFAULT 'PLATAFORMA';
