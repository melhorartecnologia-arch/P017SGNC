-- CreateTable
CREATE TABLE "severidades" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "nivel" INTEGER NOT NULL,
    "cor" VARCHAR(7),
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "severidades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "severidades_codigo_key" ON "severidades"("codigo");
CREATE UNIQUE INDEX "severidades_nivel_key" ON "severidades"("nivel");
