-- CreateTable
CREATE TABLE "DiagnosticoPregunta" (
    "id" TEXT NOT NULL,
    "diagnosticoId" TEXT NOT NULL,
    "preguntaId" TEXT NOT NULL,

    CONSTRAINT "DiagnosticoPregunta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticoPregunta_diagnosticoId_idx" ON "DiagnosticoPregunta"("diagnosticoId");

-- CreateIndex
CREATE INDEX "DiagnosticoPregunta_preguntaId_idx" ON "DiagnosticoPregunta"("preguntaId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticoPregunta_diagnosticoId_preguntaId_key" ON "DiagnosticoPregunta"("diagnosticoId", "preguntaId");

-- AddForeignKey
ALTER TABLE "DiagnosticoPregunta" ADD CONSTRAINT "DiagnosticoPregunta_diagnosticoId_fkey" FOREIGN KEY ("diagnosticoId") REFERENCES "Diagnostico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticoPregunta" ADD CONSTRAINT "DiagnosticoPregunta_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "Pregunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
