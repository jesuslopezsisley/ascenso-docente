/**
 * ⚠️  UTILERÍA DE DESARROLLO — NO ES PARTE DE LA APP.
 *
 * Borra usuarios POR PATRÓN DE EMAIL (todo lo que termina en "@example.com")
 * y toda su data derivada del diagnóstico (respuestas, preguntas asignadas,
 * plan de estudio, sesiones, diagnósticos). Sirve para limpiar la data que
 * dejan las pruebas en vivo contra la base de producción.
 *
 * NUNCA correr esto contra una base con usuarios reales: si algún usuario
 * legítimo llegara a registrarse con un correo "@example.com", lo borraría
 * junto con todo su historial. Antes de usarlo, revisá el dry-run.
 *
 * Uso (desde backend/):
 *   npx tsx scripts/dev-tools/cleanup-test-data.ts           dry-run: solo lista
 *   npx tsx scripts/dev-tools/cleanup-test-data.ts --apply   borra de verdad
 *
 * Apunta a la base de DATABASE_URL del .env (hoy: la de producción vía proxy).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const apply = process.argv.includes('--apply');
const testUser = { email: { endsWith: '@example.com' } };
const delDiag = { diagnostico: { is: { usuario: { is: testUser } } } };

async function main() {
  const usuarios = await prisma.usuario.findMany({
    where: testUser,
    select: { email: true, _count: { select: { diagnosticos: true } } },
  });
  console.log(`Usuarios de prueba: ${usuarios.length}`);
  for (const u of usuarios) {
    console.log(`  ${u.email}  (${u._count.diagnosticos} diagnósticos)`);
  }

  if (!apply) {
    console.log('\n(dry-run) volvé a correr con --apply para borrar.');
    return;
  }

  const r = await prisma.$transaction([
    prisma.sesionPlan.deleteMany({ where: { planEstudio: { is: delDiag } } }),
    prisma.planEstudio.deleteMany({ where: delDiag }),
    prisma.respuesta.deleteMany({ where: delDiag }),
    prisma.diagnosticoPregunta.deleteMany({ where: delDiag }),
    prisma.diagnostico.deleteMany({ where: { usuario: { is: testUser } } }),
    prisma.usuario.deleteMany({ where: testUser }),
  ]);

  console.log('\nBorrado:', {
    sesionPlan: r[0].count,
    planEstudio: r[1].count,
    respuesta: r[2].count,
    diagnosticoPregunta: r[3].count,
    diagnostico: r[4].count,
    usuario: r[5].count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
