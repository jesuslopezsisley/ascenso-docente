# Arquitectura base — plantilla para proyectos nuevos

> Extraído por análisis del repositorio `medmind` (backend NestJS + frontend Next.js) el 2026-08-22.
> **Objetivo de este documento**: describir la *forma* de la arquitectura (stack, capas, convenciones) para reutilizarla como plantilla en un proyecto nuevo y distinto. No contiene lógica de negocio, modelos de datos completos ni nombres de dominio médico salvo como ejemplo puntual y aislado.

---

## 0. Resumen ejecutivo

Dos aplicaciones independientes, sin monorepo ni workspace compartido:

- **`backend.*`** — API REST NestJS 11 + Prisma/PostgreSQL, autenticación JWT propia, arquitectura modular por dominio.
- **`frontend.*`** — Next.js 15 (App Router, React 19), sesión propia (cookie firmada, distinta de los JWT del backend), capa de servicios server-side hacia la API.

Los dos proyectos se comunican solo por HTTP (REST). No comparten tipos, ni paquetes, ni base de datos. Esto es replicable tal cual para un dominio distinto: basta con clonar la forma y vaciar el contenido de negocio.

---

## 1. Stack y versiones exactas

### Backend

| Pieza | Versión | Por qué se eligió (inferido del uso real) |
|---|---|---|
| NestJS (`@nestjs/core`, `@nestjs/common`) | `^11.0.1` | Framework opinado sobre Express con DI, decoradores, módulos — reduce el boilerplate de un API REST grande con muchos dominios (30+ módulos en este proyecto) manteniendo separación de responsabilidades. |
| `@nestjs/platform-express` | `^11.1.6` | Adaptador HTTP; Express en vez de Fastify por compatibilidad con middlewares de terceros (multer, etc). |
| TypeScript | `^5.7.3` | Tipado estático en todo el stack, incluido el cliente Prisma generado. |
| Prisma (`@prisma/client` / CLI) | `^6.18.0` / `^6.15.0` | ORM con migraciones versionadas, cliente tipado autogenerado y soporte de *multi-schema* de PostgreSQL (útil si el dominio crece y quieres separar tablas por bounded context dentro de la misma base). |
| `@nestjs/config` | `^4.0.2` | Carga de `.env` centralizada, inyectable vía `ConfigService` (evita `process.env` disperso). |
| `@nestjs/swagger` | `^11.2.0` | Documentación OpenAPI autogenerada a partir de decoradores en DTOs/controllers. |
| `@nestjs/jwt` + `passport` + `passport-jwt` + `passport-local` | `^11.0.0` / `^0.7.0` / `^4.0.1` / `^1.0.0` | Autenticación JWT access+refresh con estrategias Passport estándar. |
| `class-validator` + `class-transformer` | `^0.14.2` / `^0.5.1` | Validación declarativa de DTOs vía decoradores, integrada con el `ValidationPipe` global de Nest. |
| `bcrypt` | `^6.0.0` | Hashing de contraseñas. |
| `@nestjs/terminus` | `^11.0.0` | Health checks estándar (`/health`, `/health/live`, `/health/ready`). |
| `@willsoto/nestjs-prometheus` + `prom-client` | `^6.0.2` / `^15.1.3` | Métricas Prometheus expuestas en `/metrics`, con un interceptor global que las alimenta. |
| `@nestjs/schedule` | `^6.0.1` | Tareas cron in-process (sin infraestructura externa tipo cron externo). |
| Jest + `@nestjs/testing` + `supertest` | `^30.0.0` / `^11.0.1` / `^7.0.0` | Unit tests colocados junto al código + e2e con supertest sobre la app Nest completa. |
| ESLint 9 (flat config) + Prettier | `^9.18.0` / `^3.4.2` | Linting/formato estándar del ecosistema TS actual. |

**Nota sobre package manager**: el `README` del backend indica `pnpm` para tests, pero la mayoría de scripts (`prisma:*`, `db:reset`, `cli:*`) se documentan con `yarn`. Para una plantilla nueva, conviene fijar **un solo** package manager desde el día uno (esta inconsistencia es deuda a no heredar).

### Frontend

| Pieza | Versión | Por qué (inferido) |
|---|---|---|
| Next.js | `^15.5.7` | App Router + React Server Components: permite resolver sesión/roles en el servidor antes de renderizar (ver §5), reduciendo lógica de auth en el cliente. |
| React / React DOM | `19.1.2` | Requerido por Next 15; habilita Server Components y las nuevas APIs de formularios/acciones. |
| TypeScript | `^5` | Tipado end-to-end junto con el backend (sin compartir tipos automáticamente — se duplican manualmente, ver §8). |
| Tailwind CSS | `^4` (`@tailwindcss/postcss`) | v4 es *CSS-first*: no hay `tailwind.config.*`, el theming vive en `globals.css` vía `@theme`. Menos indirección para un proyecto nuevo. |
| Radix UI (paquetes `@radix-ui/react-*` + meta-paquete `radix-ui`) | variado, + `^1.4.3` el meta-paquete | Primitivas accesibles sin estilos, base del patrón shadcn (ver §6). |
| `class-variance-authority` + `tailwind-merge` | `^0.7.1` / `^3.3.1` | Variantes de componentes tipadas (`cva`) + resolución de conflictos de clases Tailwind (`cn()`). |
| Zustand | `^5.0.8` | Estado cliente ligero, sin boilerplate de Redux, para los pocos casos que no caben en Server Components. |
| `jose` | `^6.1.0` | Firma/verificación de JWT en Edge Runtime (middleware) — `jsonwebtoken` no corre en Edge, `jose` sí. |
| Framer Motion / `motion` | `^12.23.22` / `^12.23.24` | Animaciones declarativas (nota: ambos paquetes coexisten en este repo, probablemente resabio de migración — en una plantilla nueva elegir solo uno). |
| ECharts, Recharts, `@xyflow/react`, `markmap-*` | varios | Visualización de datos/gráficos/diagramas de flujo — específico de necesidades de este dominio, no imprescindible en una plantilla genérica. |
| Playwright | `^1.60.0` | E2E con sesión pre-autenticada reutilizable (`storageState`). |

---

## 2. Backend — estructura de carpetas y convenciones de módulo

### 2.1 Bootstrap de un módulo típico

```
src/<dominio>/
  controllers/
    <recurso>.controller.ts
  services/
    <recurso>.service.ts
  dto/
    create-<recurso>.dto.ts
    update-<recurso>.dto.ts
  <dominio>.module.ts
```

Módulos más grandes añaden `interfaces/`, `jobs/`, `scripts/`, `prompts/`, `tests/unit/`. No hay carpeta `entities/` separada: el "modelo" es el tipo generado por Prisma (`@prisma/client`), no una clase de dominio propia — el DTO de entrada y el tipo Prisma de salida son las dos únicas representaciones de datos.

**`<dominio>.module.ts`** — patrón:
```ts
@Module({
  imports: [PrismaModule],
  controllers: [ARecurso Controller, BRecursoController, ...],
  providers: [ARecursoService, BRecursoService, ...],
  exports: [ARecursoService, BRecursoService, ...],
})
```
Un módulo puede agrupar varios sub-recursos relacionados (varios controllers/services) en vez de crear un módulo por cada entidad — útil cuando varias entidades son inseparables en su ciclo de vida (p. ej. una entidad "contenedora" + sus "ítems").

**Controller** — patrón repetido en todos los recursos:
```ts
@ApiTags('Recurso')
@Controller('recurso')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecursoController {
  constructor(private readonly service: RecursoService) {}

  @Post()
  @ApiOperation({ summary, description })
  @ApiResponse({ status, description })
  async create(@Body() dto: CreateRecursoDto, @Req() req: any) {
    const userId = req.user.id; // inyectado por JwtAuthGuard
    return { message: 'Creado', data: await this.service.create(userId, dto) };
  }
}
```
El shape de retorno de **cada** handler es `{ message: string, data: T }`. Nunca se retorna el dato "pelado": esto es lo que consume el interceptor global (§4) para envolverlo en el shape final de respuesta HTTP.

**Service** — patrón repetido:
```ts
@Injectable()
export class RecursoService {
  constructor(private prisma: PrismaService) {}

  async update(id: string, userId: string, dto: UpdateRecursoDto) {
    const existing = await this.prisma.recurso.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Recurso no encontrado');
    return this.prisma.recurso.update({ where: { id }, data: dto });
  }
}
```
Convención constante: **verificar pertenencia del recurso al usuario autenticado con `findFirst({ where: { id, ownerId } })` antes de cualquier mutación**, lanzando `NotFoundException`/`BadRequestException`/`ForbiddenException` de `@nestjs/common` — nunca se confía en el `id` de la URL sin cruzarlo contra el usuario.

**DTOs**:
```ts
export class CreateRecursoDto {
  @ApiProperty({ description: '...' })
  @IsString()
  @MaxLength(255)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class UpdateRecursoDto extends PartialType(CreateRecursoDto) {}
```
- `@ApiProperty`/`@ApiPropertyOptional` (Swagger) siempre acompañan a los decoradores de `class-validator`.
- Los DTOs de update usan `PartialType` **de `@nestjs/swagger`** (no de `@nestjs/mapped-types`) — así el DTO resultante conserva también los metadatos de Swagger, no solo la opcionalidad de campos.

### 2.2 `app.module.ts` — composición raíz

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` — una sola vez, config disponible en toda la app sin reimportar.
- `ServeStaticModule.forRoot(...)` — uno por cada carpeta estática a servir (ej. imágenes subidas), cada una con su propio `serveRoot`.
- `ScheduleModule.forRoot()` — habilita `@Cron()`/`@Interval()` en cualquier provider.
- Import plano de todos los módulos de dominio (uno por línea). Con 30+ módulos, esta lista es el único "mapa" real del sistema — vale la pena mantenerla ordenada alfabéticamente o por capas en un proyecto nuevo.

### 2.3 Bootstrap HTTP — `main.ts`

Piezas reutilizables tal cual para cualquier dominio:

1. **`bodyParser: false`** en `NestFactory.create` + middleware manual que bifurca por `Content-Type`: si es `multipart/form-data` deja pasar sin parsear (para Multer), si no aplica `json()`/`urlencoded()` de Express con límite explícito. Necesario en cuanto el API acepta subida de archivos junto con JSON normal.
2. **Prefijo global** `/api` vía `setGlobalPrefix`, con exclusión explícita de `metrics` y las rutas de `health*` (estas deben quedar fuera de cualquier prefijo/versión para que un load balancer o Prometheus las encuentre en una ruta estable).
3. **Versionado por URI** (`VersioningType.URI`, `defaultVersion: '1'`) — todo controller es v1 salvo que declare `@Version('2')` explícitamente. Patrón útil para introducir un subsistema nuevo (ej. RAG) sin romper contratos existentes.
4. **Orden de interceptores globales**: interceptor de métricas **antes** que el interceptor de shape de respuesta — así el de métricas mide el tiempo real de la request, no el tiempo ya transformado.
5. **Filtros de excepción globales**: un filtro específico (`@Catch(HttpException)`) + un catch-all (`@Catch()`), ambos normalizando a un mismo shape de error (§4).
6. **`ValidationPipe` global**: `{ transform: true, whitelist: true, forbidNonWhitelisted: true }` — cualquier campo no declarado en el DTO hace fallar la request (400) en vez de ser ignorado silenciosamente. Es la pieza que hace cumplir el contrato de cada DTO.
7. **CORS**: en desarrollo, abierto sin restricción; en producción, whitelist armada desde variables de entorno (orígenes separados por coma) + regex opcional, con `credentials: true`. Patrón reutilizable: nunca hardcodear los orígenes permitidos, siempre vía env.
8. **Swagger condicional**: solo se monta si `SWAGGER_ENABLED=true`, en `/api/docs` — evita exponer documentación en producción por accidente si no se activa explícitamente.

---

## 3. Autenticación, roles y guards — flujo completo

### 3.1 Componentes

```
src/auth/
  auth.module.ts
  controllers/auth.controller.ts
  decorators/  (current-user, roles, permissions)
  dto/         (login, register, refresh-token, change-password, ...)
  guards/      (jwt-auth, local-auth, roles, permissions, email-verified)
  services/    (auth.service, jwt.service, password.service)
  strategies/  (jwt.strategy, local.strategy)
```

### 3.2 Flujo de login

1. `POST /auth/login` → `LocalAuthGuard` (`extends AuthGuard('local')`) dispara `LocalStrategy.validate(email, password)`, que delega en `AuthService.login()` (verifica hash con `PasswordService`, busca roles activos).
2. Si es válido, el controller pide a `JwtTokenService` un **access token** (payload `{ sub, email, roles }`, secret `JWT_SECRET`, vida corta ~15 min) y un **refresh token** (payload `{ sub, tokenId }`, secret `JWT_REFRESH_SECRET`, vida larga ~7 días).
3. Ambos tokens se devuelven al cliente en el body de la respuesta (el backend NO setea cookies — la sesión de cookie es responsabilidad del frontend, ver §5).

### 3.3 Flujo de request autenticada

1. Cada endpoint protegido declara `@UseGuards(JwtAuthGuard)` explícito (**no hay guard global ni decorador `@Public`** — todo lo que no lleve el guard es público por diseño, así que la ausencia del decorador es la señal de "ruta pública", no al revés).
2. `JwtAuthGuard extends AuthGuard('jwt')` dispara `JwtStrategy.validate(payload)`, que llama a `AuthService.validateUser(payload)` — este método **enriquece** el payload mínimo del JWT con el perfil completo del usuario (roles, permisos, estado de suscripción, etc.) consultando la base de datos, y ese objeto enriquecido queda en `request.user`.
3. `@CurrentUser()` (param decorator) lee `request.user`; acepta un argumento opcional para extraer un solo campo: `@CurrentUser('id')`.
4. Para autorización adicional:
   - `@Roles('ADMIN', 'EDITOR')` + `RolesGuard` → exige que el usuario tenga **al menos uno** de los roles listados (`.some()`).
   - `@RequirePermissions('recurso.crear')` + `PermissionsGuard` → exige que el usuario tenga **todos** los permisos listados (`.every()`).
   - Ambos leen metadata seteada por `SetMetadata()` vía `Reflector.getAllAndOverride`, combinable en el mismo endpoint (`@Roles` + `@RequirePermissions` juntos).
   - `EmailVerifiedGuard` — guard adicional que exige `emailVerifiedAt` no nulo; requiere que `JwtAuthGuard` se aplique antes en la cadena.

### 3.4 Refresh de token

`POST /auth/refresh` (sin guard, recibe `refreshToken` en el body):
1. Verifica firma/expiración del refresh token.
2. Vuelve a resolver el usuario y sus roles activos desde la base de datos (no confía en el payload viejo).
3. Emite un **nuevo par** access+refresh (rotación).

**Patrón a decidir explícitamente en un proyecto nuevo** (en este repo quedó a medias): si se quiere revocación real de refresh tokens, se necesita una tabla que persista `tokenId`/hash del refresh token vigente y se invalide en logout — sin eso, un refresh token robado sigue siendo válido hasta que expira por tiempo, y "logout" es solo un efecto de cliente (borrar el token localmente), no del lado servidor.

### 3.5 Guards — resumen de responsabilidad única

| Guard | Verifica | Falla con |
|---|---|---|
| `JwtAuthGuard` | Token válido y no expirado | `UnauthorizedException` |
| `RolesGuard` | Al menos uno de los roles requeridos | `ForbiddenException` |
| `PermissionsGuard` | Todos los permisos requeridos | `ForbiddenException` |
| `EmailVerifiedGuard` | Email verificado (requiere `JwtAuthGuard` antes) | `ForbiddenException` |

Cada guard es independiente y componible vía `@UseGuards(A, B, C)` — patrón limpio para reusar: nunca meter dos verificaciones en un mismo guard.

---

## 4. Prisma — servicio, migraciones, patrones de consulta

### 4.1 `PrismaService`

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private config: ConfigService) {
    super();
    this.setupLogging(); // suscribe eventos 'query'/'warn'/'error' de Prisma a Logger de Nest
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```
Registrado en un `PrismaModule` marcado `@Global()` — así cualquier módulo puede inyectar `PrismaService` sin reimportar el módulo explícitamente (aunque por claridad muchos módulos lo importan igual).

### 4.2 Schema partido por dominio

El schema no es un único `schema.prisma`: usa la *preview feature* `prismaSchemaFolder` y vive en `prisma/schema/*.prisma` (un archivo por dominio: auth, core, dominio-específico-1, dominio-específico-2, enums...), más un `schema.prisma` que solo contiene `generator`/`datasource`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
  binaryTargets   = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth", "core", "..."]   // multi-schema de Postgres
}
```
Toda invocación del CLI de Prisma usa `--schema=prisma/schema` (carpeta, no archivo). Esto es directamente reusable: dividir el schema por dominio evita un archivo gigante ingobernable a medida que el proyecto crece, y el multi-schema de Postgres es opcional (se puede omitir el array `schemas` si no se necesita separar físicamente tablas por schema de base de datos).

### 4.3 Migraciones

```bash
prisma generate --schema=prisma/schema     # regenerar cliente tras cambiar el schema
prisma migrate dev --schema=prisma/schema  # nueva migración en desarrollo
prisma migrate reset --schema=prisma/schema && <seed>  # destructivo, reset+reseed
```
Seeds separados por propósito (`prisma/seed.ts` principal + seeds adicionales bajo `prisma/seeds/`), cada uno invocable por su propio script — patrón útil cuando hay datos semilla de distinta naturaleza (catálogos base vs. datos de ejemplo/demo).

### 4.4 Patrones de consulta reutilizables

- **Soft delete manual**: un helper `notDeleted(where)` que mezcla `{ ...where, deletedAt: null }`, tipado genérico. Convención: `deletedAt: null` = registro activo. Se optó por un helper de función simple en vez de `$extends` de Prisma — más explícito, menos "magia" en cada query.
- **Verificación de pertenencia antes de mutar**: `findFirst({ where: { id, ownerId } })` seguido de `NotFoundException` si no existe (ver §2.1) — es el patrón de autorización a nivel de fila más repetido en todo el código.
- **Transacciones**: dos formas usadas indistintamente según el caso —
  - `this.prisma.$transaction(async (tx) => { ... })` cuando los pasos dependen del resultado del paso anterior.
  - `this.prisma.$transaction([op1, op2, ...])` cuando son operaciones independientes que solo necesitan atomicidad (ej. reordenar un batch de filas).
- **`$queryRaw` tipado** con template literal (`` this.prisma.$queryRaw<T[]>`...` ``) reservado para agregaciones que serían costosas o imposibles de expresar limpiamente con el query builder — usado como excepción puntual, no como patrón por defecto.
- **Paginación**: en este repo se implementa *ad hoc* por servicio (`skip`/`take` manuales) — **no existe** un DTO/helper de paginación genérico compartido. Para una plantilla nueva, vale la pena crear ese helper genérico desde el inicio (algo como `PaginationDto { page, limit }` + una función `paginate(prisma.model, where, { page, limit })` que devuelva `{ data, pagination: { total, page, totalPages } }`) en vez de repetir el cálculo en cada service, que es la limitación real observada aquí.

---

## 5. Frontend — routing, llamadas a la API, estado, errores

### 5.1 Routing (App Router)

Route groups por audiencia, cada uno con su propio `layout.tsx` cuando necesita compartir chrome de UI o lógica de auth:

```
src/app/
  (auth)/          # login, recuperar contraseña — sin layout propio
  (landing)/        # páginas públicas de marketing — layout mínimo (solo metadata)
  (portal)/         # contenido público con header/footer compartido
  dashboard/         # panel admin — layout server-side con guard de rol
  <area-autenticada>/
    (sinLayout)/     # subrutas sin el shell de sidebar
    (conLayout)/     # subrutas con sidebar — layout con guard de sesión+plan
  api/               # route handlers locales (BFF, ver 5.4)
```

**Patrón repetido en cada `layout.tsx` de área protegida** (dashboard, área autenticada principal, etc.):
1. `getUser()` → obtiene sesión desde la cookie firmada (server-side).
2. Llamada al backend (`/auth/me` equivalente) para refrescar el perfil.
3. Chequeo de rol/plan → `redirect()` si no corresponde.
4. Construcción del menú lateral con una función que mapea `roles → items de navegación` (server-safe, no expone rutas no permitidas al bundle del cliente).
5. Render del shell (sidebar/header) + `children`.

Cada layout de área exporta `dynamic = 'force-dynamic'` (a veces `revalidate = 0`) porque el contenido depende de la sesión del usuario — no se puede cachear estáticamente.

### 5.2 Sesión (cookie propia, distinta de los JWT del backend)

`src/lib/session.ts` (server-only):
- Cookie httpOnly, `sameSite: 'lax'`, `secure` en producción, firmada con `jose` (`SignJWT`/`jwtVerify`, algoritmo HS256) usando un secreto propio del frontend (**distinto** del `JWT_SECRET` del backend).
- El payload de la cookie contiene `{ user, accessToken, refreshToken, expiresAt }` — es decir, la cookie envuelve los tokens del backend, no los reemplaza. El navegador nunca ve el JWT del backend directamente; solo la cookie firmada del frontend.

`src/middleware.ts` (Edge Runtime, corre solo en las rutas protegidas vía `matcher`):
1. Verifica la cookie de sesión; si falta o es inválida → limpia y redirige a login.
2. RBAC: compara la ruta solicitada contra la lista de rutas permitidas para los roles del usuario (derivada de la misma función `roles → menú` usada en los layouts).
3. **Refresh transparente**: decodifica el `exp` del access token (sin verificar firma, solo lectura del payload — la verificación real ya la hizo el backend al emitirlo); si falta poco tiempo, dispara un refresh contra el backend y re-firma la cookie con los tokens nuevos.
4. **Lock anti "refresh storm"**: una cookie de corta duración (segundos) marca que un refresh ya está en curso, para que pestañas/requests concurrentes no disparen refresh duplicados.
5. **Fail-open vs. fail-closed**: si el backend **rechaza explícitamente** el refresh token (credencial inválida) → se destruye la sesión inmediatamente. Si el fallo es de red/timeout (error transitorio) → se deja pasar la request con la sesión aún vigente en la cookie, para no tirar abajo la sesión de un usuario por una caída momentánea del backend.

Este patrón (cookie propia firmada + refresh transparente en middleware + fail-open en fallos transitorios) es completamente reusable para cualquier dominio: es infraestructura de sesión, no lógica de negocio.

### 5.3 Llamadas a la API — capa de servicios

```
src/services/<dominio>.service.ts   # una función 'use server' por operación
```
Patrón repetido en cada service:
```ts
'use server'
import { fetchMethods } from '@/.../fetch-core';

const PATH = '/recurso';

export async function getRecurso(): Promise<RecursoResponse> {
  const response = await fetchMethods.get(`${PATH}`);
  try {
    return await response.json();
  } catch {
    return { success: false, message: 'Error parsing response', error: {...} };
  }
}
```
El wrapper `fetchMethods` (capa interna, no expuesta directamente a componentes) centraliza:
- Base URL desde variable de entorno (`NEXT_PUBLIC_API_URL`), con soporte de una segunda base para una versión distinta del API (v2).
- Construcción de headers: `Authorization: Bearer <accessToken>` leído de la sesión server-side, `Content-Type` (salvo `FormData`), y reenvío de IP real del cliente.
- Los services **nunca lanzan** excepciones hacia el caller: siempre devuelven un objeto `{ success, message, data, pagination? }` tipado, incluso en el `catch`. Esto simplifica el manejo de errores en los Server/Client Components consumidores (nunca necesitan `try/catch`, solo chequear `.success`).

**Distinción importante**: `src/lib/client-fetch.ts` es un alias explícito sobre `window.fetch` para uso en Client Components — el manejo de 401 no vive ahí, vive en un interceptor global (`FetchInterceptor`) montado una sola vez en el layout raíz, que:
1. Monkey-patchea `window.fetch` en un `useEffect`.
2. Si una respuesta es 401, intenta un refresh (deduplicado con una promesa memoizada para no disparar refresh concurrentes) y reintenta la request original una vez.
3. Si el refresh falla, fuerza la expiración de sesión (redirect a una ruta que la destruye).

### 5.4 Rutas API locales (`src/app/api/`) — patrón BFF

Dos variantes observadas, ambas válidas según el caso:
- **Delegar a un service existente**: el route handler solo llama a la función de `src/services/*` y traduce el resultado a `NextResponse.json`. Útil cuando un Client Component necesita pegarle a una ruta propia del frontend (por ejemplo, para no exponer el token de acceso al bundle cliente) pero la lógica ya vive en el service server-side.
- **Proxy directo**: el handler resuelve la sesión, sanea query params, hace `fetch` directo al backend con `cache: 'no-store'`, y normaliza la forma de la respuesta antes de devolverla. Útil para casos con transformación específica de la respuesta (paginación, desanidado) que no amerita un service reusable.

Ambos patrones comparten: try/catch envolvente total (nunca dejan escapar una excepción sin capturar) y resolución de credenciales siempre server-side.

### 5.5 Estado (Zustand)

Solo para estado cliente que no cabe naturalmente en Server Components (ej. un feed con paginación incremental y actualizaciones optimistas). Patrón:
```ts
export const useXStore = create<State>((set, get) => ({
  items: [], loading: false, loaded: false,
  async fetchX(force) {
    if (get().loaded && !force) return;   // idempotente
    if (get().loading) return;             // evita llamadas concurrentes
    set({ loading: true });
    const data = await xService.getX();
    set({ items: data, loading: false, loaded: true });
  },
}));
```
Sin middlewares (`persist`/`devtools`) en este repo — decisión consciente si el estado no necesita sobrevivir a un refresh de página.

### 5.6 UI

Componentes de presentación shadcn-style en `src/components/ui/` (sin subcarpetas, uno por componente), estilo "new-york", sobre primitivas Radix + `class-variance-authority` para variantes + `cn()` (clsx + tailwind-merge) para composición de clases:
```ts
const buttonVariants = cva("clases-base", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: { variant: 'default', size: 'default' },
});
function Button({ className, variant, size, asChild, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```
Tailwind v4: no hay `tailwind.config.*`; `postcss.config.mjs` solo declara el plugin `@tailwindcss/postcss`, y el theming (colores, fuentes, breakpoints) se define con `@theme` dentro de `globals.css`.

---

## 6. Convenciones transversales

### 6.1 Shape de respuesta (backend)

Todo handler retorna `{ message, data }`; un interceptor global lo transforma en el shape final:
```ts
// éxito
{ success: true, message: string, data: T, pagination?: {...} }
// error (vía exception filters)
{ success: false, error: { message: string, code?: string, errors?: any } }
```
- `pagination` solo se agrega si la URL de la request matchea una **lista explícita (allowlist) de rutas paginadas** dentro del interceptor — esto es una decisión de diseño deliberada (evita que cualquier endpoint "accidentalmente" devuelva pagination sin que el frontend la espere), pero exige recordar añadir cada endpoint nuevo paginado a esa lista.
- Dos exception filters globales: uno específico para `HttpException` (normaliza errores de `class-validator` a un mensaje genérico + array de `errors`), y un catch-all para cualquier excepción no controlada. **Punto a decidir distinto en un proyecto nuevo**: en este repo el catch-all incluye el `stack` trace en la respuesta sin condicionar por entorno — en una plantilla nueva conviene omitir el stack cuando `NODE_ENV === 'production'`.

### 6.2 Validación

`ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true, transform: true`) es la única capa de validación de entrada — no hay pipes custom. Cada DTO es el contrato completo del endpoint; cualquier campo no declarado hace fallar la request.

### 6.3 Swagger

Montado condicionalmente (`SWAGGER_ENABLED=true`) en `/api/docs`, alimentado por los mismos decoradores `@ApiTags`/`@ApiOperation`/`@ApiProperty` que ya llevan los controllers/DTOs por otras razones (documentación como subproducto de la validación/tipado, no un esfuerzo aparte).

### 6.4 Paginación

**Backend**: `skip`/`take` manuales por servicio, sin helper genérico (oportunidad de mejora, ver §4.4).
**Frontend**: cada store/service que pagina sigue el mismo patrón — mantener `page`, `hasMore` derivado de `pagination.total`, y una acción `loadMore()` que incrementa `page` y hace merge de resultados.

### 6.5 Manejo de errores end-to-end

1. Backend: excepción → exception filter → shape `{ success: false, error }`.
2. Frontend service: `try/catch` alrededor del `fetch`, nunca relanza — siempre retorna `{ success: false, message }`.
3. Componente consumidor: chequea `.success`, nunca envuelve la llamada al service en su propio `try/catch` (ya está manejado un nivel abajo).
4. Único punto donde sí se lanza una acción "dura" (redirect/logout) es el `FetchInterceptor` global ante un 401 sin refresh posible.

---

## 7. Checklist — crear un módulo nuevo desde cero

### Backend (NestJS + Prisma)

1. Añadir el modelo al archivo de schema Prisma correspondiente (o crear uno nuevo bajo `prisma/schema/` si es un dominio nuevo).
2. `prisma migrate dev --schema=prisma/schema` → genera la migración y regenera el cliente.
3. Crear la carpeta `src/<dominio>/` con `controllers/`, `services/`, `dto/`.
4. DTOs: `CreateXDto` con `@ApiProperty` + decoradores `class-validator`; `UpdateXDto extends PartialType(CreateXDto)` (de `@nestjs/swagger`).
5. Service: inyectar `PrismaService`; en cada mutación, verificar pertenencia del recurso al usuario (`findFirst({ where: { id, ownerId } })`) antes de tocar nada.
6. Controller: `@ApiTags`, `@Controller('recurso')`, `@UseGuards(JwtAuthGuard)` (+ `@Roles`/`@RequirePermissions` si aplica), `@ApiBearerAuth()`; cada handler retorna `{ message, data }`.
7. Si el listado necesita paginación, añadir la ruta a la allowlist del `ApiResponseInterceptor`.
8. `<dominio>.module.ts`: importar `PrismaModule`, registrar controllers/services, exportar los services que otros módulos puedan necesitar.
9. Registrar el módulo en `app.module.ts`.
10. Escribir `*.spec.ts` junto al service/controller (patrón `Test.createTestingModule({...}).compile()`).
11. Si el módulo expone algo consumible desde otros módulos, exportar el service — nunca importar el `PrismaService` de otro módulo directamente para acceder a sus datos.

### Frontend (Next.js)

1. Crear `src/services/<dominio>.service.ts` con funciones `'use server'`, todas devolviendo `{ success, message, data, pagination? }`, nunca lanzando excepciones.
2. Si el dominio necesita rutas: decidir si van dentro de un área ya protegida (heredan el layout con guard de sesión/rol existente) o si necesitan una nueva route group con su propio `layout.tsx`.
3. Si la ruta requiere un rol/plan específico, añadirla al mapa `roles → navegación` y, si corresponde, a `PLAN_FEATURES`.
4. Componentes de servidor: llaman al service directamente. Componentes de cliente: si necesitan datos on-demand, pasan por un route handler propio en `src/app/api/` (patrón §5.4) o por un store Zustand si el estado debe compartirse entre varios componentes cliente.
5. UI: componer con primitivas existentes de `src/components/ui/`; si se necesita una nueva, seguir el patrón `cva` + `cn()`.
6. Tests: agregar el flujo crítico a `e2e/` si involucra un flujo de usuario completo; usar `auth.setup.ts` existente para partir de una sesión ya autenticada.

---

## 8. Qué es genérico/reusable vs. qué es específico del dominio

### Reusable tal cual (infraestructura, no depende del dominio)

- Todo `main.ts` (bootstrap, CORS, versionado, interceptores, filtros, ValidationPipe).
- El patrón completo de `src/auth/` (estrategias, guards, decoradores, flujo de refresh) — **el `AuthService` sí referenciará el modelo `User` del dominio, pero la mecánica de guards/estrategias/tokens es 100% portable**.
- `PrismaService` + patrón de módulo global + schema partido en carpeta.
- `ApiResponseInterceptor` + exception filters + el shape `{ success, message, data }` / `{ success, error }`.
- El patrón completo de sesión del frontend (`session.ts`, `middleware.ts`, `FetchInterceptor`) — es infraestructura de auth de aplicación web, no tiene ninguna referencia a negocio.
- La capa de servicios (`'use server'` + `fetchMethods` + shape de retorno uniforme).
- Los componentes de `src/components/ui/` (shadcn) — genéricos por definición.
- La estructura de carpetas por capas (`controllers/services/dto` en backend; `app/` fino + `modules/` con la lógica en frontend).
- El checklist de creación de módulo (§7) completo.

### Específico del dominio médico actual (NO copiar la lógica, solo la forma)

- Los ~35 módulos de negocio del backend (cuestionarios adaptativos con IRT, flashcards con repetición espaciada, simulacros de examen, currícula médica, rachas/gamificación estilo Duolingo, RAG para asistentes de IA, etc.) — son ejemplos de "cómo se ve un módulo lleno", no plantilla a reutilizar.
- El pipeline offline de generación de preguntas vía LLM (`scripts/question-pipeline/`) — específico de generación de contenido educativo médico.
- Los modelos Prisma concretos (`quiz`, `flashcards`, `simulacros`, `curriculum`, etc.) y el multi-schema de Postgres asociado — el *mecanismo* de "schema partido + multi-schema" es reusable, los nombres de schema no.
- Los mapas de roles/menú/planes de suscripción concretos (`Roles.STUDENT`, `PLAN_FEATURES`, rutas de `URL_CONFIG`) — la *mecánica* (rol→menú, plan→features, diccionario central de rutas) es reusable; los valores son del dominio.
- Las librerías de visualización específicas del caso de uso (`@xyflow/react` para mapas curriculares, `markmap-*` para mapas mentales, ECharts para dashboards de progreso académico) — inclúyelas en la plantilla nueva solo si el dominio nuevo también necesita ese tipo de visualización.
- Los proveedores de IA integrados (`@anthropic-ai/sdk`, `@google/generative-ai`, `openai`) y el subsistema RAG — solo si el proyecto nuevo también necesita IA generativa/búsqueda semántica.

---

## 9. Deuda conocida a NO replicar en la plantilla nueva

Observaciones surgidas del análisis, listadas aquí para que el proyecto nuevo arranque limpio:

1. **Refresh token sin revocación real**: el payload incluye `tokenId` "para revocación futura" pero no hay tabla ni blacklist — decidir esto explícitamente desde el inicio si se necesita logout real del lado servidor.
2. **Stack trace en respuesta de error sin condicionar por entorno** — el catch-all filter debe omitir el `stack` en producción.
3. **Sin helper de paginación genérico** en el backend — crearlo desde el primer módulo paginado, no siete módulos después.
4. **Dos fuentes de configuración de expiración de sesión** en el frontend (un valor hardcodeado en `session.ts`, otro en un archivo de config separado) — mantener una sola fuente de verdad.
5. **Inconsistencia de package manager** (yarn vs. pnpm según el comando) — fijar uno solo.
6. **Paquetes duplicados con la misma función** (`framer-motion` y `motion` a la vez) — resultado de migraciones a medias; evitarlo desde el principio.
