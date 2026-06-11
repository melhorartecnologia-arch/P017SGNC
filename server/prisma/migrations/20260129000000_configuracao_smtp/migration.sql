-- Configuração técnica do servidor SMTP (workflow de e-mails).
CREATE TYPE "SmtpSeguranca" AS ENUM ('NONE', 'SSL', 'TLS');

CREATE TABLE "configuracoes_smtp" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "host" VARCHAR(160) NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 587,
    "seguranca" "SmtpSeguranca" NOT NULL DEFAULT 'TLS',
    "usuario" VARCHAR(160),
    "senha" VARCHAR(255),
    "remetente_nome" VARCHAR(120) NOT NULL,
    "remetente_email" VARCHAR(160) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_smtp_pkey" PRIMARY KEY ("id")
);
