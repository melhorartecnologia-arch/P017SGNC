-- CreateTable
CREATE TABLE "turnos_trabalho" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_trabalho_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "turnos_trabalho_codigo_key" ON "turnos_trabalho"("codigo");
CREATE INDEX "turnos_trabalho_nome_idx" ON "turnos_trabalho"("nome");
