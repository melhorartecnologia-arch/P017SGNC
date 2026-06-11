-- Registro de assinatura por aprovador na matriz da RNC.
ALTER TABLE "rnc_aprovadores" ADD COLUMN "assinado_em" TIMESTAMP(3);
