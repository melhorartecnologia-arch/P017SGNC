-- Tabelas de junção (M:N implícito do Prisma) entre TipoRelatorio e
-- Severidade / OrigemNaoConformidade / DisposicaoMaterial.

-- Severidade x TipoRelatorio
CREATE TABLE "_SeveridadeToTipoRelatorio" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_SeveridadeToTipoRelatorio_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_SeveridadeToTipoRelatorio_B_index" ON "_SeveridadeToTipoRelatorio"("B");
ALTER TABLE "_SeveridadeToTipoRelatorio"
  ADD CONSTRAINT "_SeveridadeToTipoRelatorio_A_fkey"
  FOREIGN KEY ("A") REFERENCES "severidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SeveridadeToTipoRelatorio"
  ADD CONSTRAINT "_SeveridadeToTipoRelatorio_B_fkey"
  FOREIGN KEY ("B") REFERENCES "tipos_relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrigemNaoConformidade x TipoRelatorio
CREATE TABLE "_OrigemNaoConformidadeToTipoRelatorio" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_OrigemNaoConformidadeToTipoRelatorio_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_OrigemNaoConformidadeToTipoRelatorio_B_index" ON "_OrigemNaoConformidadeToTipoRelatorio"("B");
ALTER TABLE "_OrigemNaoConformidadeToTipoRelatorio"
  ADD CONSTRAINT "_OrigemNaoConformidadeToTipoRelatorio_A_fkey"
  FOREIGN KEY ("A") REFERENCES "origens_nao_conformidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_OrigemNaoConformidadeToTipoRelatorio"
  ADD CONSTRAINT "_OrigemNaoConformidadeToTipoRelatorio_B_fkey"
  FOREIGN KEY ("B") REFERENCES "tipos_relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DisposicaoMaterial x TipoRelatorio
CREATE TABLE "_DisposicaoMaterialToTipoRelatorio" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_DisposicaoMaterialToTipoRelatorio_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_DisposicaoMaterialToTipoRelatorio_B_index" ON "_DisposicaoMaterialToTipoRelatorio"("B");
ALTER TABLE "_DisposicaoMaterialToTipoRelatorio"
  ADD CONSTRAINT "_DisposicaoMaterialToTipoRelatorio_A_fkey"
  FOREIGN KEY ("A") REFERENCES "disposicoes_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DisposicaoMaterialToTipoRelatorio"
  ADD CONSTRAINT "_DisposicaoMaterialToTipoRelatorio_B_fkey"
  FOREIGN KEY ("B") REFERENCES "tipos_relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
