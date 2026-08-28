import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiService } from '../../ia/services/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompetenciaNombre,
  PATRON_SIMULACION_POR_DEFECTO,
} from '../constants/competencias';
import { PatronCompetenciaDto } from '../dto/simular.dto';
import { ResponderDto } from '../dto/responder.dto';
import {
  calcularCuposPorCompetencia,
  elegirAlAzar,
} from '../utils/muestreo-preguntas';
import { ExplicacionesService } from './explicaciones.service';

const ALTERNATIVAS = ['A', 'B', 'C'] as const;
const CANTIDAD_PREGUNTAS_DIAGNOSTICO = 60;

@Injectable()
export class DiagnosticoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly explicaciones: ExplicacionesService,
  ) {}

  /**
   * Arma un diagnóstico de CANTIDAD_PREGUNTAS_DIAGNOSTICO preguntas mediante
   * muestreo estratificado: el cupo de cada competencia es proporcional a
   * cuánto representa en el banco acumulado de TODOS los años sembrados
   * para este nivelEspecialidad (ver muestreo-preguntas.ts), y dentro de
   * cada competencia las preguntas elegidas son al azar entre todos los
   * años disponibles. La asignación se persiste en DiagnosticoPregunta
   * porque el banco completo ya no equivale a "las preguntas de este
   * diagnóstico" (puede tener preguntas de varios años).
   */
  async crear(usuarioId: string, nivelEspecialidadId: string) {
    const bancoPreguntas = await this.prisma.pregunta.findMany({
      where: { nivelEspecialidadId },
      select: {
        id: true,
        enunciado: true,
        alternativas: true,
        competenciaId: true,
      },
    });

    const bancoPorCompetencia = new Map<string, typeof bancoPreguntas>();
    for (const p of bancoPreguntas) {
      const lista = bancoPorCompetencia.get(p.competenciaId) ?? [];
      lista.push(p);
      bancoPorCompetencia.set(p.competenciaId, lista);
    }

    const conteos = [...bancoPorCompetencia.entries()].map(
      ([competenciaId, lista]) => ({ competenciaId, total: lista.length }),
    );
    const cupos = calcularCuposPorCompetencia(
      conteos,
      CANTIDAD_PREGUNTAS_DIAGNOSTICO,
    );

    const seleccionadas = [...bancoPorCompetencia.entries()].flatMap(
      ([competenciaId, lista]) =>
        elegirAlAzar(lista, cupos.get(competenciaId) ?? 0),
    );
    const preguntas = elegirAlAzar(seleccionadas, seleccionadas.length);

    const diagnostico = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.diagnostico.create({
        data: { usuarioId, nivelEspecialidadId },
      });
      await tx.diagnosticoPregunta.createMany({
        data: preguntas.map((p) => ({
          diagnosticoId: creado.id,
          preguntaId: p.id,
        })),
      });
      return creado;
    });

    return { diagnostico, preguntas };
  }

  /**
   * Historial: todos los diagnósticos del usuario, del más reciente al más
   * antiguo. Para los completados incluye el puntaje total (mismo cálculo
   * que finalizar(): respuestas correctas / preguntas asignadas). Los que
   * siguen en progreso van con puntaje null.
   */
  async listar(usuarioId: string) {
    const diagnosticos = await this.prisma.diagnostico.findMany({
      where: { usuarioId },
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        fecha: true,
        estado: true,
        _count: {
          select: {
            preguntasAsignadas: true,
            respuestas: { where: { esCorrecta: true } },
          },
        },
      },
    });

    return diagnosticos.map((d) => {
      const totalPreguntas = d._count.preguntasAsignadas;
      const correctas = d._count.respuestas;
      return {
        id: d.id,
        fecha: d.fecha,
        estado: d.estado,
        puntaje:
          d.estado === 'completado' && totalPreguntas > 0
            ? Math.round((correctas / totalPreguntas) * 100)
            : null,
      };
    });
  }

  /** Verifica que el diagnóstico exista y pertenezca al usuario autenticado. */
  private async obtenerPropio(diagnosticoId: string, usuarioId: string) {
    const diagnostico = await this.prisma.diagnostico.findFirst({
      where: { id: diagnosticoId, usuarioId },
    });
    if (!diagnostico) {
      throw new NotFoundException('Diagnóstico no encontrado');
    }
    return diagnostico;
  }

  /**
   * Flujo único de guardado + cálculo de una respuesta. Usado tanto por el
   * endpoint /responder como por /simular (docs/arquitectura-base.md: la
   * lógica de negocio vive una sola vez en el service).
   */
  async responder(diagnosticoId: string, usuarioId: string, dto: ResponderDto) {
    const diagnostico = await this.obtenerPropio(diagnosticoId, usuarioId);
    if (diagnostico.estado === 'completado') {
      throw new BadRequestException('El diagnóstico ya fue finalizado');
    }

    const asignacion = await this.prisma.diagnosticoPregunta.findUnique({
      where: {
        diagnosticoId_preguntaId: { diagnosticoId, preguntaId: dto.preguntaId },
      },
      include: { pregunta: true },
    });
    if (!asignacion) {
      throw new NotFoundException(
        'La pregunta no pertenece a este diagnóstico',
      );
    }
    const pregunta = asignacion.pregunta;

    const esCorrecta = pregunta.respuestaCorrecta === dto.alternativaElegida;

    await this.prisma.respuesta.upsert({
      where: {
        diagnosticoId_preguntaId: { diagnosticoId, preguntaId: dto.preguntaId },
      },
      create: {
        diagnosticoId,
        preguntaId: dto.preguntaId,
        alternativaElegida: dto.alternativaElegida,
        esCorrecta,
      },
      update: {
        alternativaElegida: dto.alternativaElegida,
        esCorrecta,
      },
    });

    return { preguntaId: dto.preguntaId, guardada: true };
  }

  async finalizar(diagnosticoId: string, usuarioId: string) {
    const diagnostico = await this.obtenerPropio(diagnosticoId, usuarioId);

    if (diagnostico.estado !== 'completado') {
      await this.prisma.diagnostico.update({
        where: { id: diagnosticoId },
        data: { estado: 'completado' },
      });
      // Al pasar a completado (una sola vez) se generan las explicaciones de
      // las preguntas falladas. Best-effort: el propio servicio traga sus
      // errores, así que esto nunca tumba el reporte.
      await this.explicaciones.generarParaDiagnostico(diagnosticoId);
    }

    const [asignaciones, respuestas, competencias] = await Promise.all([
      this.prisma.diagnosticoPregunta.findMany({
        where: { diagnosticoId },
        select: { pregunta: { select: { id: true, competenciaId: true } } },
      }),
      this.prisma.respuesta.findMany({
        where: { diagnosticoId },
        select: { preguntaId: true, esCorrecta: true },
      }),
      this.prisma.competencia.findMany({ orderBy: { nombre: 'asc' } }),
    ]);
    const preguntas = asignaciones.map((a) => a.pregunta);

    const esCorrectaPorPregunta = new Map(
      respuestas.map((r) => [r.preguntaId, r.esCorrecta]),
    );

    const statsPorCompetenciaId = new Map<
      string,
      { total: number; correctas: number }
    >();
    for (const p of preguntas) {
      const stats = statsPorCompetenciaId.get(p.competenciaId) ?? {
        total: 0,
        correctas: 0,
      };
      stats.total += 1;
      if (esCorrectaPorPregunta.get(p.id)) stats.correctas += 1;
      statsPorCompetenciaId.set(p.competenciaId, stats);
    }

    const reporte = competencias.map((c) => {
      const stats = statsPorCompetenciaId.get(c.id) ?? {
        total: 0,
        correctas: 0,
      };
      return {
        competencia: c.nombre,
        correctas: stats.correctas,
        total: stats.total,
        porcentaje:
          stats.total > 0
            ? Math.round((stats.correctas / stats.total) * 100)
            : 0,
      };
    });

    const correctasTotal = reporte.reduce((s, r) => s + r.correctas, 0);
    const totalPreguntas = reporte.reduce((s, r) => s + r.total, 0);

    return {
      diagnosticoId,
      estado: 'completado' as const,
      reporte,
      resumen: {
        correctasTotal,
        totalPreguntas,
        porcentajeTotal:
          totalPreguntas > 0
            ? Math.round((correctasTotal / totalPreguntas) * 100)
            : 0,
      },
    };
  }

  /**
   * Detalle pregunta por pregunta para la pantalla de revisión: las 60
   * preguntas asignadas con el enunciado, sus alternativas, la competencia,
   * la alternativa correcta, la que eligió el docente (null si no la
   * respondió), si acertó, y —solo en las falladas— la explicación generada
   * por IA (null si todavía se está generando o falló).
   */
  async obtenerRespuestas(diagnosticoId: string, usuarioId: string) {
    await this.obtenerPropio(diagnosticoId, usuarioId);

    const [asignaciones, respuestas] = await Promise.all([
      this.prisma.diagnosticoPregunta.findMany({
        where: { diagnosticoId },
        select: {
          pregunta: {
            select: {
              id: true,
              enunciado: true,
              alternativas: true,
              respuestaCorrecta: true,
              competencia: { select: { nombre: true } },
            },
          },
        },
      }),
      this.prisma.respuesta.findMany({
        where: { diagnosticoId },
        select: {
          preguntaId: true,
          alternativaElegida: true,
          esCorrecta: true,
          explicacion: true,
        },
      }),
    ]);

    const respuestaPorPregunta = new Map(
      respuestas.map((r) => [r.preguntaId, r]),
    );

    return asignaciones.map(({ pregunta: p }) => {
      const r = respuestaPorPregunta.get(p.id);
      return {
        preguntaId: p.id,
        enunciado: p.enunciado,
        alternativas: p.alternativas,
        competencia: p.competencia.nombre,
        respuestaCorrecta: p.respuestaCorrecta,
        alternativaElegida: r?.alternativaElegida ?? null,
        esCorrecta: r?.esCorrecta ?? false,
        explicacion: r && !r.esCorrecta ? r.explicacion : null,
      };
    });
  }

  /** Solo para demo (ver DemoModeGuard). Reusa responder() para cada pregunta. */
  async simular(
    diagnosticoId: string,
    usuarioId: string,
    patrones?: PatronCompetenciaDto[],
  ) {
    await this.obtenerPropio(diagnosticoId, usuarioId);

    const porcentajePorCompetencia = new Map<CompetenciaNombre, number>(
      Object.entries(PATRON_SIMULACION_POR_DEFECTO) as [
        CompetenciaNombre,
        number,
      ][],
    );
    for (const patron of patrones ?? []) {
      porcentajePorCompetencia.set(
        patron.competencia,
        patron.porcentajeAciertos,
      );
    }

    const asignaciones = await this.prisma.diagnosticoPregunta.findMany({
      where: { diagnosticoId },
      select: { pregunta: { include: { competencia: true } } },
    });
    const preguntas = asignaciones.map((a) => a.pregunta);

    const preguntasPorCompetencia = new Map<
      CompetenciaNombre,
      typeof preguntas
    >();
    for (const p of preguntas) {
      const nombre = p.competencia.nombre as CompetenciaNombre;
      const lista = preguntasPorCompetencia.get(nombre) ?? [];
      lista.push(p);
      preguntasPorCompetencia.set(nombre, lista);
    }

    for (const [nombreCompetencia, lista] of preguntasPorCompetencia) {
      const porcentaje = porcentajePorCompetencia.get(nombreCompetencia) ?? 100;
      const barajada = [...lista].sort(() => Math.random() - 0.5);
      const cantidadCorrectas = Math.round(
        (porcentaje / 100) * barajada.length,
      );

      for (let i = 0; i < barajada.length; i++) {
        const pregunta = barajada[i];
        const alternativaElegida =
          i < cantidadCorrectas
            ? pregunta.respuestaCorrecta
            : this.alternativaIncorrecta(pregunta.respuestaCorrecta);

        // Mismo flujo que POST /diagnostico/:id/responder
        await this.responder(diagnosticoId, usuarioId, {
          preguntaId: pregunta.id,
          alternativaElegida,
        });
      }
    }

    return {
      diagnosticoId,
      preguntasSimuladas: preguntas.length,
      patronUsado: Object.fromEntries(porcentajePorCompetencia),
    };
  }

  private alternativaIncorrecta(correcta: string): string {
    const opciones = ALTERNATIVAS.filter((a) => a !== correcta);
    return opciones[Math.floor(Math.random() * opciones.length)];
  }

  /**
   * Genera (o regenera) el plan de estudio estructurado con Gemini a partir
   * del reporte del diagnóstico, y lo persiste. Reusa finalizar() en vez de
   * recalcular el reporte por su cuenta. Prompt y cálculo de semanas
   * validados en test-plan.mjs antes de escribir este método.
   */
  async generarPlanEstudio(diagnosticoId: string, usuarioId: string) {
    const diagnostico = await this.obtenerPropio(diagnosticoId, usuarioId);
    if (diagnostico.estado !== 'completado') {
      throw new BadRequestException(
        'El diagnóstico debe estar finalizado para generar un plan de estudio',
      );
    }

    const { reporte } = await this.finalizar(diagnosticoId, usuarioId);
    const reportePlan: ReportePlanEstudio = {
      competencias: reporte.map((r) => ({
        nombre: r.competencia,
        correctas: r.correctas,
        total: r.total,
        porcentaje: r.porcentaje,
      })),
    };

    const semanas = this.calcularSemanas(reportePlan);
    const prompt = this.construirPromptPlanEstudio(reportePlan, semanas);
    const textoCrudo = await this.gemini.generarTexto(prompt);
    const plan = this.parsearPlanEstudio(textoCrudo);

    const sesionesData = plan.sesiones.map((s) => ({
      semana: s.semana,
      competencia: s.competencia,
      tema: s.tema,
      quePracticar: s.quePracticar,
    }));

    const planExistente = await this.prisma.planEstudio.findUnique({
      where: { diagnosticoId },
    });

    if (planExistente) {
      // Las sesiones no tienen upsert natural (cambian de cantidad y
      // contenido en cada regeneración): se borran y se recrean en una
      // sola transacción atómica junto con la actualización del plan.
      const [, actualizado] = await this.prisma.$transaction([
        this.prisma.sesionPlan.deleteMany({
          where: { planEstudioId: planExistente.id },
        }),
        this.prisma.planEstudio.update({
          where: { id: planExistente.id },
          data: {
            semanas: plan.semanas,
            resumen: plan.resumen,
            sesiones: { create: sesionesData },
          },
          include: { sesiones: true },
        }),
      ]);
      return actualizado;
    }

    return this.prisma.planEstudio.create({
      data: {
        diagnosticoId,
        semanas: plan.semanas,
        resumen: plan.resumen,
        sesiones: { create: sesionesData },
      },
      include: { sesiones: true },
    });
  }

  /** Verifica que la sesión pertenezca a un plan de un diagnóstico del usuario. */
  private async obtenerSesionPropia(
    diagnosticoId: string,
    usuarioId: string,
    sesionId: string,
  ) {
    await this.obtenerPropio(diagnosticoId, usuarioId);

    const sesion = await this.prisma.sesionPlan.findFirst({
      where: {
        id: sesionId,
        planEstudio: { diagnosticoId },
      },
    });
    if (!sesion) {
      throw new NotFoundException('Sesión no encontrada');
    }
    return sesion;
  }

  async completarSesion(
    diagnosticoId: string,
    usuarioId: string,
    sesionId: string,
  ) {
    await this.obtenerSesionPropia(diagnosticoId, usuarioId, sesionId);
    return this.prisma.sesionPlan.update({
      where: { id: sesionId },
      data: { completada: true },
    });
  }

  async obtenerProgreso(diagnosticoId: string, usuarioId: string) {
    await this.obtenerPropio(diagnosticoId, usuarioId);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { diagnosticoId },
      include: { sesiones: true },
    });
    if (!plan) {
      throw new NotFoundException(
        'Este diagnóstico no tiene un plan de estudio generado',
      );
    }

    const totalSesiones = plan.sesiones.length;
    const completadas = plan.sesiones.filter((s) => s.completada).length;

    return {
      totalSesiones,
      completadas,
      porcentaje:
        totalSesiones > 0
          ? Math.round((completadas / totalSesiones) * 1000) / 10
          : 0,
    };
  }

  /**
   * 1 competencia <50% -> 2 semanas, 2-3 <50% -> 4 semanas, 4+ <50% -> 6
   * semanas. El caso "0 competencias <50%" no está especificado en la regla
   * original; se usa 2 (el mínimo) como default razonable.
   */
  private calcularSemanas(reporte: ReportePlanEstudio): number {
    const debiles = reporte.competencias.filter(
      (c) => c.porcentaje < 50,
    ).length;
    if (debiles >= 4) return 6;
    if (debiles >= 2) return 4;
    return 2;
  }

  private construirPromptPlanEstudio(
    reporte: ReportePlanEstudio,
    semanas: number,
  ): string {
    return `Eres un asesor pedagógico que diseña planes de estudio para docentes
peruanos que se preparan para el examen de ascenso de escala magisterial (EBR Primaria).

Aquí está el resultado del diagnóstico del docente, con el porcentaje de aciertos
por competencia pedagógica:

${JSON.stringify(reporte, null, 2)}

Genera un plan de estudio de EXACTAMENTE ${semanas} semanas. Prioriza las competencias
con menor porcentaje, dedicándoles más sesiones. Las competencias con 100% no necesitan
sesiones (ya están dominadas). Cada sesión debe indicar SOLO el tema y qué practicar
(sin sugerir links, videos, libros ni recursos externos).

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "semanas": ${semanas},
  "resumen": "una frase breve sobre el enfoque general del plan",
  "sesiones": [
    {
      "semana": 1,
      "competencia": "resolucion_problemas_matematicos",
      "tema": "string breve",
      "quePracticar": "string, 1-2 oraciones concretas y accionables"
    }
  ]
}`;
  }

  private parsearPlanEstudio(textoCrudo: string): PlanEstudioGenerado {
    let limpio = textoCrudo.trim();
    const fenceMatch = limpio.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fenceMatch) {
      limpio = fenceMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(limpio);
    } catch {
      throw new ServiceUnavailableException(
        'Gemini devolvió una respuesta que no se pudo interpretar como JSON',
      );
    }

    if (!this.esPlanEstudioValido(parsed)) {
      throw new ServiceUnavailableException(
        'Gemini devolvió un plan de estudio con un formato inesperado',
      );
    }

    return parsed;
  }

  private esPlanEstudioValido(valor: unknown): valor is PlanEstudioGenerado {
    if (typeof valor !== 'object' || valor === null) return false;
    const v = valor as Record<string, unknown>;
    return (
      typeof v.semanas === 'number' &&
      typeof v.resumen === 'string' &&
      Array.isArray(v.sesiones) &&
      v.sesiones.every((s) => this.esSesionValida(s))
    );
  }

  private esSesionValida(valor: unknown): valor is SesionPlanEstudio {
    if (typeof valor !== 'object' || valor === null) return false;
    const v = valor as Record<string, unknown>;
    return (
      typeof v.semana === 'number' &&
      typeof v.competencia === 'string' &&
      typeof v.tema === 'string' &&
      typeof v.quePracticar === 'string'
    );
  }
}

interface ReportePlanEstudio {
  competencias: {
    nombre: string;
    correctas: number;
    total: number;
    porcentaje: number;
  }[];
}

interface SesionPlanEstudio {
  semana: number;
  competencia: string;
  tema: string;
  quePracticar: string;
}

interface PlanEstudioGenerado {
  semanas: number;
  resumen: string;
  sesiones: SesionPlanEstudio[];
}
