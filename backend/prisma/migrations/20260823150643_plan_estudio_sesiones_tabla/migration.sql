/*
  Warnings:

  - You are about to drop the column `sesiones` on the `PlanEstudio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PlanEstudio" DROP COLUMN "sesiones";

-- CreateTable
CREATE TABLE "SesionPlan" (
    "id" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "competencia" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "quePracticar" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "planEstudioId" TEXT NOT NULL,

    CONSTRAINT "SesionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SesionPlan_planEstudioId_idx" ON "SesionPlan"("planEstudioId");

-- AddForeignKey
ALTER TABLE "SesionPlan" ADD CONSTRAINT "SesionPlan_planEstudioId_fkey" FOREIGN KEY ("planEstudioId") REFERENCES "PlanEstudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
