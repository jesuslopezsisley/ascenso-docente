-- AlterTable
ALTER TABLE "Pregunta" ADD COLUMN     "anio" INTEGER;

-- DataMigration: las preguntas existentes hasta ahora son todas del
-- cuadernillo 2018; se poblan retroactivamente para que "anio" quede
-- siempre poblado desde este punto en adelante.
UPDATE "Pregunta" SET "anio" = 2018 WHERE "anio" IS NULL;
