-- Remove campos de endereço do fornecedor.
DROP INDEX IF EXISTS "fornecedores_cidade_uf_idx";

ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "endereco";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "numero";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "complemento";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "bairro";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "cidade";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "uf";
ALTER TABLE "fornecedores" DROP COLUMN IF EXISTS "cep";
