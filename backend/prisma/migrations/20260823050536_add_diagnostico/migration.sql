-- CreateEnum
CREATE TYPE "EstadoDiagnostico" AS ENUM ('en_progreso', 'completado');

-- CreateTable
CREATE TABLE "Diagnostico" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoDiagnostico" NOT NULL DEFAULT 'en_progreso',
    "usuarioId" TEXT NOT NULL,
    "nivelEspecialidadId" TEXT NOT NULL,

    CONSTRAINT "Diagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Respuesta" (
    "id" TEXT NOT NULL,
    "alternativaElegida" TEXT NOT NULL,
    "esCorrecta" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosticoId" TEXT NOT NULL,
    "preguntaId" TEXT NOT NULL,

    CONSTRAINT "Respuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Diagnostico_usuarioId_idx" ON "Diagnostico"("usuarioId");

-- CreateIndex
CREATE INDEX "Diagnostico_nivelEspecialidadId_idx" ON "Diagnostico"("nivelEspecialidadId");

-- CreateIndex
CREATE INDEX "Respuesta_diagnosticoId_idx" ON "Respuesta"("diagnosticoId");

-- CreateIndex
CREATE INDEX "Respuesta_preguntaId_idx" ON "Respuesta"("preguntaId");

-- CreateIndex
CREATE UNIQUE INDEX "Respuesta_diagnosticoId_preguntaId_key" ON "Respuesta"("diagnosticoId", "preguntaId");

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_nivelEspecialidadId_fkey" FOREIGN KEY ("nivelEspecialidadId") REFERENCES "NivelEspecialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Respuesta" ADD CONSTRAINT "Respuesta_diagnosticoId_fkey" FOREIGN KEY ("diagnosticoId") REFERENCES "Diagnostico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Respuesta" ADD CONSTRAINT "Respuesta_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "Pregunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
