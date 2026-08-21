-- Aprovadores marcados recebem as respostas do fornecedor (aceite/recusa)
-- após a conclusão de todas as assinaturas.
ALTER TABLE "aprovadores"
  ADD COLUMN "recebe_resposta_fornecedor" BOOLEAN NOT NULL DEFAULT false;
