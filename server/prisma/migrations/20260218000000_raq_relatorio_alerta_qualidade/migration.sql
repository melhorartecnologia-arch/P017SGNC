-- RAQ — Relatório de Alerta de Qualidade. Compartilha a tabela e o
-- workflow de assinatura da RNC via discriminador tipo_documento, com
-- campos, numeração e conclusão próprios (assinado → e-mail ao
-- fornecedor → encerrado, sem ciência/resposta).

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('RNC', 'RAQ');

-- AlterTable
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'RNC',
  ADD COLUMN "titulo" VARCHAR(200),
  ADD COLUMN "reincidente" BOOLEAN,
  ADD COLUMN "reincidente_vezes" INTEGER,
  ADD COLUMN "observacoes_complementares" TEXT,
  ADD COLUMN "enviado_fornecedor_em" TIMESTAMP(3),
  ADD COLUMN "enviado_fornecedor_para" VARCHAR(160),
  ALTER COLUMN "tipo_nao_conformidade_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "relatorios_nao_conformidade_tipo_documento_idx"
  ON "relatorios_nao_conformidade"("tipo_documento");

-- AlterTable
ALTER TABLE "filiais" ADD COLUMN "raq_numero_inicial" INTEGER NOT NULL DEFAULT 0;

-- RAQs relacionados (reincidência): vínculo N:N entre documentos.
CREATE TABLE "_RaqRelacionados" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_RaqRelacionados_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_RaqRelacionados_B_index" ON "_RaqRelacionados"("B");
ALTER TABLE "_RaqRelacionados"
  ADD CONSTRAINT "_RaqRelacionados_A_fkey"
  FOREIGN KEY ("A") REFERENCES "relatorios_nao_conformidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RaqRelacionados"
  ADD CONSTRAINT "_RaqRelacionados_B_fkey"
  FOREIGN KEY ("B") REFERENCES "relatorios_nao_conformidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tipos de relatório que cada aprovador assina. Sem vínculo, assina
-- todos os tipos — mesmo padrão da restrição de turno.
CREATE TABLE "_AprovadorToTipoRelatorio" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_AprovadorToTipoRelatorio_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_AprovadorToTipoRelatorio_B_index" ON "_AprovadorToTipoRelatorio"("B");
ALTER TABLE "_AprovadorToTipoRelatorio"
  ADD CONSTRAINT "_AprovadorToTipoRelatorio_A_fkey"
  FOREIGN KEY ("A") REFERENCES "aprovadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AprovadorToTipoRelatorio"
  ADD CONSTRAINT "_AprovadorToTipoRelatorio_B_fkey"
  FOREIGN KEY ("B") REFERENCES "tipos_relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
