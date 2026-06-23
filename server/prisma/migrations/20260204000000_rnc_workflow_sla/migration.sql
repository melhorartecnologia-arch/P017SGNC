-- SLA do workflow de assinatura (Política de Resposta): lembrete e escalonamento.
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "assinatura_enviada_em" TIMESTAMP(3),
  ADD COLUMN "escalonado_em" TIMESTAMP(3);

ALTER TABLE "rnc_aprovadores"
  ADD COLUMN "lembrete_enviado_em" TIMESTAMP(3),
  ADD COLUMN "via_escalonamento" BOOLEAN NOT NULL DEFAULT false;
