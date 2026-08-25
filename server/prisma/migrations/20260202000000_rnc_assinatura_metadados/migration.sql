-- Senha (OTP de 6 dígitos) e metadados técnicos da assinatura.
ALTER TABLE "rnc_aprovadores"
  ADD COLUMN "senha_assinatura" VARCHAR(6),
  ADD COLUMN "assinatura_ip" VARCHAR(64),
  ADD COLUMN "assinatura_user_agent" TEXT,
  ADD COLUMN "assinatura_navegador" VARCHAR(120),
  ADD COLUMN "assinatura_so" VARCHAR(120),
  ADD COLUMN "assinatura_dispositivo" VARCHAR(120),
  ADD COLUMN "assinatura_latitude" DOUBLE PRECISION,
  ADD COLUMN "assinatura_longitude" DOUBLE PRECISION,
  ADD COLUMN "assinatura_precisao" DOUBLE PRECISION,
  ADD COLUMN "assinatura_metadados" JSONB;
