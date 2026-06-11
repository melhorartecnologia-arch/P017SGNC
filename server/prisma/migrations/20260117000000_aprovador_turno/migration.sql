-- Aprovador ganha um vínculo opcional com um turno de trabalho.
ALTER TABLE "aprovadores" ADD COLUMN "turno_id" UUID;

ALTER TABLE "aprovadores"
  ADD CONSTRAINT "aprovadores_turno_id_fkey"
  FOREIGN KEY ("turno_id") REFERENCES "turnos_trabalho"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "aprovadores_turno_id_idx" ON "aprovadores"("turno_id");
