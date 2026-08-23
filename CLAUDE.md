Este proyecto sigue las convenciones documentadas en docs/arquitectura-base.md.
Consúltalo antes de crear módulos, definir DTOs, guards, o tomar decisiones
de arquitectura o manejo de errores.

Contexto de lo ya construido: el schema de Prisma (NivelEspecialidad,
Competencia, Pregunta) y el seed ya existen y están corriendo sobre
PostgreSQL local vía Docker. No los reconstruyas — solo tenlos en cuenta
al crear los módulos NestJS que los consuman.

Nota de versión: este proyecto usa Prisma 7 con adaptador `pg`
(`@prisma/adapter-pg`) y un único `schema.prisma`. La sección de
docs/arquitectura-base.md sobre Prisma 6 y schema partido
(`prisma/schema/*.prisma`, prismaSchemaFolder) es solo referencia de
convención general — no la sigas al pie de la letra aquí. No bajar la
versión de Prisma ni migrar a schema partido en este proyecto.
