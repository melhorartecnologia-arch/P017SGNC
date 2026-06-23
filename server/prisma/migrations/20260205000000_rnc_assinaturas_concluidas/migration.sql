-- Marca quando todas as assinaturas da RNC foram concluídas (evita
-- reenvio do e-mail de conclusão).
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "assinaturas_concluidas_em" TIMESTAMP(3);
