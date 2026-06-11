-- Turnos passam a pertencer a uma filial. Trocamos a unique de `codigo`
-- por uma composta em (filial_id, codigo). Como o cadastro é novo,
-- removemos qualquer linha existente para garantir que o filial_id
-- NOT NULL possa ser aplicado sem dados pendentes.
DELETE FROM "turnos_trabalho";

DROP INDEX "turnos_trabalho_codigo_key";

ALTER TABLE "turnos_trabalho" ADD COLUMN "filial_id" UUID NOT NULL;

ALTER TABLE "turnos_trabalho"
  ADD CONSTRAINT "turnos_trabalho_filial_id_fkey"
  FOREIGN KEY ("filial_id") REFERENCES "filiais"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "turnos_trabalho_filial_id_codigo_key"
  ON "turnos_trabalho"("filial_id", "codigo");
CREATE INDEX "turnos_trabalho_filial_id_idx" ON "turnos_trabalho"("filial_id");
