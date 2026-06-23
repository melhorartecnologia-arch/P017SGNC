-- Token de link mágico para o aprovador acessar e assinar a RNC por e-mail.
ALTER TABLE "rnc_aprovadores" ADD COLUMN "token_assinatura" VARCHAR(64);

CREATE UNIQUE INDEX "rnc_aprovadores_token_assinatura_key"
  ON "rnc_aprovadores"("token_assinatura");
