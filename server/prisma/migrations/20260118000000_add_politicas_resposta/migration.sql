-- CreateTable
CREATE TABLE "politicas_resposta" (
    "id" UUID NOT NULL,
    "tipo_relatorio_id" UUID NOT NULL,
    "horas_resposta" INTEGER NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicas_resposta_pkey" PRIMARY KEY ("id")
);

-- Uma política por tipo de relatório.
CREATE UNIQUE INDEX "politicas_resposta_tipo_relatorio_id_key"
  ON "politicas_resposta"("tipo_relatorio_id");

ALTER TABLE "politicas_resposta"
  ADD CONSTRAINT "politicas_resposta_tipo_relatorio_id_fkey"
  FOREIGN KEY ("tipo_relatorio_id") REFERENCES "tipos_relatorio"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
