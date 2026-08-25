-- Prazo de resposta passa a aceitar horas fracionárias (horas e minutos).
ALTER TABLE "politicas_resposta"
  ALTER COLUMN "horas_resposta" SET DATA TYPE DOUBLE PRECISION;
