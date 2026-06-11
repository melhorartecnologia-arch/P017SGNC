-- Remove campos opcionais da tabela filiais.
ALTER TABLE "filiais" DROP COLUMN IF EXISTS "insc_estadual";
ALTER TABLE "filiais" DROP COLUMN IF EXISTS "responsavel";
ALTER TABLE "filiais" DROP COLUMN IF EXISTS "telefone";
ALTER TABLE "filiais" DROP COLUMN IF EXISTS "email";
