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
| Nombrar cualquier cosa del dominio (siempre) | [`glosario.md`](glosario.md) |

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
| Íconos | lucide-react — elegida, todavía sin instalar |
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

### Estructura del repositorio

La raíz separa las dos mitades. Cada una conserva la convención de su
ecosistema puertas adentro:

```
backend/                        ← .NET
├── CSH.slnx
├── Directory.Build.props       ← nullable + warnings como errores, para toda la solución
├── src/
│   ├── CSH.Host/              ← entry point delgado: compone módulos y arranca la app
│   ├── CSH.Shared/            ← kernel compartido: Result<T>, Error, contratos, eventos
│   ├── CSH.Entradas/          ← bounded context completo (M1)
│   ├── CSH.Parqueo/           ← (M2)
│   ├── CSH.Cuponera/          ← (M3)
│   ├── CSH.Restaurantes/      ← (M4)
│   ├── CSH.Salones/           ← alquiler de espacios (M5)
│   ├── CSH.Sitio/             ← contenido: jugadores, noticias, contacto (M6)
│   ├── CSH.Usuarios/          ← cuentas, roles, auditoría (M7)
│   ├── CSH.Analytics/         ← (M8)
│   ├── CSH.Red/               ← portal cautivo del wifi del estadio (M10)
│   └── CSH.Membresias/        ← socios: cuota, carné QR, beneficios (M11)
└── tests/
    ├── CSH.Entradas.Tests/
    ├── CSH.Parqueo.Tests/
    └── ...

frontend/                       ← SPA React (ver harness_DEV_frontend.md)
├── src/
└── (los tests viven junto al código, no en un directorio aparte)

docs/                           ← el harness y el glosario
.github/                        ← workflows
```

No se usa `src/` ni `tests/` en la raíz: en la aplicación anterior de este
mismo repo `src/` era el frontend, y reciclar el nombre para el backend
garantiza confusión.

Los códigos `M1`–`M11` son las épicas del
[board del proyecto](https://github.com/orgs/S3-Simple-Software-Solutions/projects/2),
que es donde vive el alcance. `M9` es la app móvil del aficionado (React Native
/ Expo): consume la misma API pero no es un proyecto de esta solución. Autentica
con bearer contra Cognito, mientras la web usa cookie vía BFF — ver
[`harness_DEV_backend.md §6`](harness_DEV_backend.md).

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
- **El frontend espeja los bounded contexts del backend:** un directorio en `frontend/src/modules/` por módulo.

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
dotnet restore backend/CSH.slnx
npm install --prefix frontend

# 2. Connection string local — user-secrets, NUNCA en appsettings.json
dotnet user-secrets set "ConnectionStrings:Default" \
  "Host=localhost;Database=csh_dev;Username=postgres;Password=<tu-clave>" \
  --project backend/src/CSH.Host

# 3. Aplicar las migraciones de cada módulo (una por DbContext)
dotnet ef database update --project backend/src/CSH.Entradas --startup-project backend/src/CSH.Host --context EntradasDbContext
dotnet ef database update --project backend/src/CSH.Parqueo  --startup-project backend/src/CSH.Host --context ParqueoDbContext
# …repetir por cada módulo
```

### Día a día — dos terminales

```bash
# Terminal 1 — backend con hot reload
dotnet watch --project backend/src/CSH.Host
```

```bash
# Terminal 2 — frontend
npm run dev --prefix frontend
```

Se trabaja contra **`http://localhost:5173`** (Vite), no contra el puerto del
backend. Vite proxea `/api` al backend, así que el frontend ve el mismo origen
que en producción y las cookies de sesión funcionan igual que en el deploy.

| Proceso | Puerto | Definido en |
|---|---|---|
| Vite (lo que abrís en el browser) | 5173 | `frontend/vite.config.ts` |
| CSH.Host (API) | 5080 | `backend/src/CSH.Host/Properties/launchSettings.json` |

Si cambiás el puerto del backend, hay que cambiarlo **en los dos lados** — el
proxy de Vite apunta a un puerto fijo.

### Trampas conocidas

- **Varios `DbContext` en la solución:** todo comando `dotnet ef` necesita
  `--context`. Sin ese flag falla con "More than one DbContext was found".
- **Migración en el proyecto equivocado:** `--project` es el módulo dueño de la
  migración; `--startup-project` es siempre `backend/src/CSH.Host`.
- **Cookie de sesión que no pega:** si estás entrando por el puerto del backend
  en vez de por Vite, el origen no coincide con el del login. Usá 5173.
- **`dotnet watch` no toma un archivo nuevo:** reiniciarlo. El watcher no
  siempre detecta archivos creados fuera del editor.
- **No crear un namespace que termine en `.Results`.** Colisiona con
  `Microsoft.AspNetCore.Http.Results`, y el compilador resuelve `Results.Ok(...)`
  contra el namespace propio: `error CS0234: el nombre 'Ok' no existe`. Por eso
  `Result<T>` y `Error` viven en `CSH.Shared` a secas, aunque los archivos estén
  en la carpeta `Results/`.
- **El alias `@/` del frontend se declara en dos lados:** `vite.config.ts` para
  el bundler y `tsconfig.app.json` para el compilador. Si falta uno, el build
  pasa y el typecheck falla, o al revés.

---

## 4. Validación antes de PR

```bash
# Backend
dotnet build backend/CSH.slnx
dotnet test backend/CSH.slnx                    # requiere Docker corriendo (Testcontainers)

# Frontend
npm run lint --prefix frontend        # oxlint
npm run typecheck --prefix frontend   # tsc --noEmit
npm run test --prefix frontend        # Vitest
npm run build --prefix frontend       # build de producción
```

Ningún PR llega a revisión con errores de compilación, de tipos, o con tests
en rojo.

Estos son exactamente los mismos comandos que corre
[`ci.yml`](../.github/workflows/ci.yml) en cada PR contra `dev` y contra `main`.
Si acá se agrega uno, se agrega allá — y al revés: un gate que solo corre en CI
sorprende a quien validó local y creía estar listo.

---

## 5. Cómo se hacen cumplir estas reglas

Una regla que solo vive en prosa se rompe en tres semanas. Estas son las capas
que las sostienen, de la más barata a la más cara.

### Capa 1 — Referencias de proyecto (gratis)

**La barrera más fuerte ya está en el diseño.** Si `CSH.Entradas` no tiene un
`ProjectReference` a `CSH.Parqueo`, el import no compila. No hace falta ningún
test para el límite entre módulos.

Lo que hay que vigilar es que **nadie agregue la referencia**. Eso se ve en el
diff de cualquier PR como un cambio en un `.csproj` — si aparece uno, es una
decisión de arquitectura y se discute, no se aprueba de corrido.

### Capa 2 — Compilador y analyzers

En `Directory.Build.props`, para toda la solución:

```xml
<Nullable>enable</Nullable>
<TreatWarningsAsErrors>true</TreatWarningsAsErrors>
<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
```

Del lado del frontend, `"strict": true` en `tsconfig.json` cubre el equivalente.

### Capa 3 — Tests de arquitectura (ArchUnitNET)

Para lo que el compilador no puede ver. Cuatro reglas, en un proyecto
`CSH.Architecture.Tests`:

```csharp
// 1. Domain no depende de Infrastructure — dentro del módulo no hay frontera de proyecto
Types().That().ResideInNamespace("CSH.*.Domain", true)
    .Should().NotDependOnAny(Types().That().ResideInNamespace("CSH.*.Infrastructure", true))

// 2. Ningún handler toca HttpContext — la regla de ICurrentUser (§ backend)
Classes().That().HaveNameEndingWith("Handler")
    .Should().NotDependOnAny("Microsoft.AspNetCore.Http")

// 3. El DbContext no se usa fuera de Infrastructure
Types().That().AreAssignableTo(typeof(DbContext))
    .Should().OnlyBeAccessedBy(Types().That().ResideInNamespace("CSH.*.Infrastructure", true))

// 4. Todo handler devuelve Result<T> — nada de excepciones para flujo de negocio
Methods().That().AreDeclaredIn(Classes().That().HaveNameEndingWith("Handler"))
    .And().ArePublic().Should().HaveReturnType(typeof(Task<>))
```

### Capa 4 — ESLint en el frontend

```js
// Nada de fetch fuera de shared/utils/api.ts
'no-restricted-globals': ['error', { name: 'fetch', message: 'Usá apiFetch.' }]

// Un módulo no importa de otro módulo
'import/no-restricted-paths': [/* modules/* → modules/* prohibido */]
```

Con `eslint-plugin-boundaries` para el segundo, que es el que más se rompe solo.

### Lo que NO se puede verificar por máquina

Estas reglas son reales pero ninguna herramienta las chequea. Van al checklist
de revisión de PR, y se dice explícitamente que dependen del criterio de quien
revisa — no se finge que están cubiertas:

- La lógica de negocio está en el handler, no repartida.
- El repositorio no contiene reglas de negocio.
- `CSH.Shared` se mantiene delgado.
- Los nombres siguen el [glosario](glosario.md).
- El `detail` de un `Error` es texto que se le puede mostrar a un aficionado.

### Orden de implementación

Las capas 1 y 2 se montan con el primer módulo, porque son configuración. Las
capas 3 y 4 tienen sentido **cuando exista el primer módulo real** contra el
cual escribir las reglas — antes son tests sobre código que no existe.

---

## 6. Lo que un agente DEV NO debe tocar

- `.github/workflows/` sin aprobación explícita del equipo.
- `docs/harness*.md` — cambios al harness van en su propio PR y se anuncian.
- Secretos: connection strings y claves van en `user-secrets` (local) o en los
  secrets del repo (CI). Nunca en `appsettings.json` ni commiteados.
- Carpetas de build: `dist/`, `bin/`, `obj/` — nunca commitear.
- Migraciones de EF Core de otro módulo — cada módulo es dueño de las suyas.

---

## 7. Estado de este documento y preguntas abiertas

**Existe el esqueleto, no los módulos.** `CSH.Host`, `CSH.Shared` y el
`frontend` compilan, pasan los gates y sirven `/healthz` más la SPA. Lo que
está verificado contra código real es eso: `Result<T>`, `Error`,
`ResultExtensions`, `apiFetch` y la configuración de los proyectos.

**El resto sigue sin compilar nunca.** Todo lo de módulos, EF Core, migraciones
con esquema, MediatR, `ICurrentUser` y el fixture de Testcontainers son
ejemplos escritos de memoria. Es la mayor parte de
[`harness_DEV_backend.md`](harness_DEV_backend.md), así que tratalo como
propuesta hasta que el primer módulo lo confirme o lo desmienta —igual que pasó
con el esqueleto, que corrigió cuatro cosas que este harness afirmaba mal.

La aplicación anterior (TypeScript + Express + React JSX) fue removida de `dev`
en el commit `b051ba6`, pero **sigue viva en `main`**, que es lo que corre en
producción hoy.

Antes de tratar este documento como fuente de verdad hay que resolver:

**1. La convivencia con producción.** Hay usuarios comprando entradas contra la
app de `main`. Mientras `dev` no tenga una solución .NET que la reemplace, un
release `dev → main` borraría producción. Falta decidir cómo se hace el corte:
si la solución nueva se termina antes de tocar `main`, o si los dos conviven
durante la transición.

**2. Glosario del dominio.** Redactado en [`glosario.md`](glosario.md), a partir
de leer la aplicación anterior. Queda pendiente **validar cuatro decisiones**
con el club antes de darlas por cerradas: si todo evento de formato `Partido`
tiene siempre un partido de calendario asociado, si el club dice "localidad" o
"sector" en su operación diaria, si `venue` y salón son el mismo concepto, y
los nombres reales de las tribunas. Ver §5 de ese documento.

**3. Enforcement.** Las capas están definidas en §5 de este documento. Las dos
primeras —referencias de proyecto y configuración del compilador— se montan con
el primer módulo. Las dos últimas —ArchUnitNET y ESLint— tienen sentido cuando
exista el primer módulo real contra el cual escribir las reglas; antes serían
tests sobre código que no existe.

**4. Sin cubrir todavía:** convenciones de datos (naming en Postgres, zona
horaria de Costa Rica), idempotencia de webhooks de Stripe, observabilidad, y
el comportamiento en el pico de apertura de venta —que es el riesgo operativo
número uno del proyecto y hoy solo está contemplado a nivel de infraestructura,
no de código.
