-- Log de envios de RNC para assinatura (histórico de workflows).
CREATE TABLE "rnc_envios_assinatura" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "rnc_numero" VARCHAR(40) NOT NULL,
    "enviado_por_id" UUID,
    "enviado_por_nome" VARCHAR(120) NOT NULL,
    "total_destinatarios" INTEGER NOT NULL,
    "destinatarios" JSONB NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rnc_envios_assinatura_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rnc_envios_assinatura_rnc_id_idx" ON "rnc_envios_assinatura"("rnc_id");
CREATE INDEX "rnc_envios_assinatura_rnc_numero_idx" ON "rnc_envios_assinatura"("rnc_numero");
CREATE INDEX "rnc_envios_assinatura_enviado_em_idx" ON "rnc_envios_assinatura"("enviado_em");

ALTER TABLE "rnc_envios_assinatura"
  ADD CONSTRAINT "rnc_envios_assinatura_rnc_id_fkey"
  FOREIGN KEY ("rnc_id") REFERENCES "relatorios_nao_conformidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rnc_envios_assinatura"
  ADD CONSTRAINT "rnc_envios_assinatura_enviado_por_id_fkey"
  FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
