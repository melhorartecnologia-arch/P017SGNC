-- Escalonamento consecutivo por nível: o aprovador escalonado perde o
-- direito de assinar; a coluna marca quando ele foi superado.
ALTER TABLE "rnc_aprovadores" ADD COLUMN "escalonado_em" TIMESTAMP(3);
