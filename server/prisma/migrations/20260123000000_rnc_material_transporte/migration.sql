-- Detalhes do material e do transporte associados ao RNC.
-- Todos os campos são opcionais: a RNC pode ser cadastrada
-- progressivamente.
ALTER TABLE "relatorios_nao_conformidade"
  ADD COLUMN "produto_id"           UUID,
  ADD COLUMN "lote"                 VARCHAR(80),
  ADD COLUMN "quantidade_lote"      DOUBLE PRECISION,
  ADD COLUMN "quantidade_defeito"   DOUBLE PRECISION,
  ADD COLUMN "tempo_parada_minutos" INTEGER,
  ADD COLUMN "numero_nf"            VARCHAR(40),
  ADD COLUMN "data_fabricacao"      TIMESTAMP(3),
  ADD COLUMN "data_validade"        TIMESTAMP(3),
  ADD COLUMN "data_recebimento"     TIMESTAMP(3),
  ADD COLUMN "transportador"        VARCHAR(160),
  ADD COLUMN "placa_cavalo"         VARCHAR(10),
  ADD COLUMN "placa_carreta"        VARCHAR(10),
  ADD COLUMN "nome_motorista"       VARCHAR(120),
  ADD COLUMN "cnh_motorista"        VARCHAR(20);

ALTER TABLE "relatorios_nao_conformidade"
  ADD CONSTRAINT "relatorios_nao_conformidade_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "relatorios_nao_conformidade_produto_id_idx"
  ON "relatorios_nao_conformidade"("produto_id");
