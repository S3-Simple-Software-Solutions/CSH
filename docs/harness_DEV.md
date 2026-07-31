# Harness DEV — Club Sport Herediano

Extiende [`harness.md`](harness.md). Aplica a cualquier agente o desarrollador
que implemente features o fixes en este repositorio.

**Este archivo es obligatorio para toda tarea.** Según qué toque la tarea, hay
que leer además el documento de la capa correspondiente.

| Si la tarea toca… | Leer también |
|---|---|
| C#, endpoints, handlers, base de datos | [`harness_DEV_backend.md`](harness_DEV_backend.md) |
| React, TypeScript, CSS | [`harness_DEV_frontend.md`](harness_DEV_frontend.md) |
| Cualquier cambio de código (siempre) | [`harness_DEV_testing.md`](harness_DEV_testing.md) |

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Backend | .NET 10 LTS — ASP.NET Core Minimal API |
| Acceso a datos | Entity Framework Core 10 + Npgsql (PostgreSQL) |
| Lenguaje backend | C# con nullable reference types habilitado |
| Mensajería interna | MediatR (eventos entre módulos) |
| Frontend | React 19 + TypeScript (`strict: true`) |
| Build frontend | Vite |
| Routing frontend | React Router |
| Estilos | CSS propio — sistema de variables de Herediano (sin librerías UI externas) |
| Íconos | lucide-react |
| Tests backend | xUnit + Testcontainers |
| Tests frontend | Vitest + React Testing Library |

---

## 2. Arquitectura — Monolito Modular + DDD + Vertical Slices

El proyecto es un **monolito modular**: un solo proceso desplegable compuesto
por módulos con límites fuertes. Cada módulo es un **bounded context**
implementado como un **proyecto `.csproj` separado** dentro de la misma
solución. El compilador enforcea los límites — no la disciplina humana.

Dentro de cada módulo, la funcionalidad se organiza en **vertical slices**:
un directorio por caso de uso.

### Estructura de la solución

```
CSH.sln
├── src/
│   ├── CSH.Host/              ← entry point delgado: compone módulos y arranca la app
│   ├── CSH.Shared/            ← kernel compartido: Result<T>, contratos, eventos
│   ├── CSH.Entradas/          ← bounded context completo
│   ├── CSH.Parqueo/
│   ├── CSH.Restaurantes/
│   ├── CSH.Usuarios/
│   └── CSH.Cuponera/
├── tests/
│   ├── CSH.Entradas.Tests/
│   ├── CSH.Parqueo.Tests/
│   └── ...
└── ClientApp/                 ← SPA React (ver harness_DEV_frontend.md)
```

Detalle de la estructura interna de un módulo backend:
[`harness_DEV_backend.md`](harness_DEV_backend.md).
Detalle del frontend: [`harness_DEV_frontend.md`](harness_DEV_frontend.md).

### Reglas — no negociables

Estas aplican a toda tarea, sin importar la capa:

- **La lógica de negocio vive en el handler**, nunca en el endpoint ni en el repositorio.
- **Los endpoints son adaptadores HTTP:** validan la request, llaman al handler, mapean la respuesta. Nada más.
- **Los repositorios son de infraestructura:** no conocen HTTP, no contienen lógica de negocio.
- **Un módulo nunca referencia internals de otro.** Si dos módulos comparten datos, usan contratos definidos en `CSH.Shared` o eventos de dominio.
- **`CSH.Shared` se mantiene delgado:** solo primitivos (`Result<T>`, `Error`, contratos, eventos). Nunca lógica de negocio — eso crea acoplamiento oculto.
- **Cada módulo es dueño de su `DbContext` y sus migraciones.** Comparten la misma base PostgreSQL pero con esquemas separados (`entradas.*`, `parqueo.*`, etc.).
- **Cada feature es un slice vertical:** endpoint + request/response + handler en el mismo directorio.
- **El frontend espeja los bounded contexts del backend:** un directorio en `ClientApp/src/modules/` por módulo.

---

## 3. Correr el proyecto localmente

### Requisitos

| | Versión | Verificar |
|---|---|---|
| .NET SDK | 10.x | `dotnet --version` |
| Node | 20+ | `node --version` |
| PostgreSQL | 16+ | `psql --version` |
| Docker | cualquiera | `docker ps` — hace falta para los tests |
| EF Core tools | 10.x | `dotnet tool install --global dotnet-ef` |

### Primera vez

```bash
# 1. Dependencias
dotnet restore CSH.sln
npm install --prefix ClientApp

# 2. Connection string local — user-secrets, NUNCA en appsettings.json
dotnet user-secrets set "ConnectionStrings:Default" \
  "Host=localhost;Database=csh_dev;Username=postgres;Password=<tu-clave>" \
  --project src/CSH.Host

# 3. Aplicar las migraciones de cada módulo (una por DbContext)
dotnet ef database update --project src/CSH.Entradas --startup-project src/CSH.Host --context EntradasDbContext
dotnet ef database update --project src/CSH.Parqueo  --startup-project src/CSH.Host --context ParqueoDbContext
# …repetir por cada módulo
```

### Día a día — dos terminales

```bash
# Terminal 1 — backend con hot reload
dotnet watch --project src/CSH.Host
```

```bash
# Terminal 2 — frontend
npm run dev --prefix ClientApp
```

Se trabaja contra **`http://localhost:5173`** (Vite), no contra el puerto del
backend. Vite proxea `/api` al backend, así que el frontend ve el mismo origen
que en producción y las cookies de sesión funcionan igual que en el deploy.

| Proceso | Puerto | Definido en |
|---|---|---|
| Vite (lo que abrís en el browser) | 5173 | `ClientApp/vite.config.ts` |
| CSH.Host (API) | 5080 | `src/CSH.Host/Properties/launchSettings.json` |

Si cambiás el puerto del backend, hay que cambiarlo **en los dos lados** — el
proxy de Vite apunta a un puerto fijo.

### Trampas conocidas

- **Varios `DbContext` en la solución:** todo comando `dotnet ef` necesita
  `--context`. Sin ese flag falla con "More than one DbContext was found".
- **Migración en el proyecto equivocado:** `--project` es el módulo dueño de la
  migración; `--startup-project` es siempre `src/CSH.Host`.
- **Cookie de sesión que no pega:** si estás entrando por el puerto del backend
  en vez de por Vite, el origen no coincide con el del login. Usá 5173.
- **`dotnet watch` no toma un archivo nuevo:** reiniciarlo. El watcher no
  siempre detecta archivos creados fuera del editor.

---

## 4. Validación antes de PR

```bash
# Backend
dotnet build CSH.sln
dotnet test CSH.sln                    # requiere Docker corriendo (Testcontainers)

# Frontend
npm run typecheck --prefix ClientApp   # tsc --noEmit
npm run test --prefix ClientApp        # Vitest
npm run build --prefix ClientApp       # build de producción
```

Ningún PR llega a revisión con errores de compilación, de tipos, o con tests
en rojo.

---

## 5. Lo que un agente DEV NO debe tocar

- `.github/workflows/` sin aprobación explícita del equipo.
- `docs/harness*.md` — cambios al harness van en su propio PR y se anuncian.
- Secretos: connection strings y claves van en `user-secrets` (local) o en los
  secrets del repo (CI). Nunca en `appsettings.json` ni commiteados.
- Carpetas de build: `dist/`, `bin/`, `obj/` — nunca commitear.
- Migraciones de EF Core de otro módulo — cada módulo es dueño de las suyas.

---

## 6. Estado de este documento y preguntas abiertas

**Este harness describe el stack destino, no el que corre hoy.** La aplicación
en `app/` es TypeScript + Express + React JSX. Nada de lo que está acá está
validado contra código real: los ejemplos no se compilaron nunca.

Antes de tratar este documento como fuente de verdad hay que resolver:

**1. La ruta de migración.** Hay usuarios comprando entradas contra la app
actual. No está decidido si se reescribe de una, módulo por módulo (strangler
fig), o si conviven los dos. Sin esa decisión, este documento describe un
destino al que nadie sabe cómo llegar.

**2. Glosario del dominio.** En el código actual conviven *evento*, *partido* y
*espectáculo*; *butaca* y *asiento*; *tribuna*, *sector* y *zona*. DDD sin
lenguaje ubicuo es solo estructura de carpetas: cada agente elige un término
distinto y el modelo se ensucia solo.

**3. Enforcement.** Todas las reglas de acá son prosa: nada impide ignorarlas.
Convertirlas en tests de arquitectura (ArchUnitNET para los límites entre
módulos, analyzers, reglas de ESLint) es lo que hace que sobrevivan más de tres
semanas.

**4. Historial de migraciones por módulo.** Varios `DbContext` sobre la misma
base colisionan en `__EFMigrationsHistory`. Cada uno necesita la suya:

```csharp
opt.UseNpgsql(conn, npgsql =>
    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "entradas"));
```

**5. Sin cubrir todavía:** convenciones de datos (naming en Postgres, zona
horaria de Costa Rica, `decimal` para colones), idempotencia de webhooks de
Stripe, observabilidad, y el comportamiento en el pico de apertura de venta
—que es el riesgo operativo número uno del proyecto y hoy solo está
contemplado a nivel de infraestructura, no de código.
