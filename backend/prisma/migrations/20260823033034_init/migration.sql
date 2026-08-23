-- CreateTable
CREATE TABLE "NivelEspecialidad" (
    "id" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NivelEspecialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competencia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregunta" (
    "id" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "alternativas" JSONB NOT NULL,
    "respuestaCorrecta" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "competenciaId" TEXT NOT NULL,
    "nivelEspecialidadId" TEXT NOT NULL,

    CONSTRAINT "Pregunta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NivelEspecialidad_nombre_key" ON "NivelEspecialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "NivelEspecialidad_nivel_especialidad_key" ON "NivelEspecialidad"("nivel", "especialidad");

-- CreateIndex
CREATE UNIQUE INDEX "Competencia_nombre_key" ON "Competencia"("nombre");

-- CreateIndex
CREATE INDEX "Pregunta_competenciaId_idx" ON "Pregunta"("competenciaId");

-- CreateIndex
CREATE INDEX "Pregunta_nivelEspecialidadId_idx" ON "Pregunta"("nivelEspecialidadId");

-- AddForeignKey
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_nivelEspecialidadId_fkey" FOREIGN KEY ("nivelEspecialidadId") REFERENCES "NivelEspecialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
