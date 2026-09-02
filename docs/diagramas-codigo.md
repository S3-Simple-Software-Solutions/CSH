# Diagramas extraídos del código

Estos diagramas **no** describen el estado destino: describen lo que hoy está
escrito en el repositorio, rama `dev`, commit `aef8df5`. Se extrajeron leyendo
`backend/`, `frontend/`, las migraciones de EF Core, `infra/` y
`.github/workflows/`.

Para el diseño destino (módulos que todavía no existen, DR en segunda región,
portal cautivo Aruba) ver [`diagramas.md`](diagramas.md). Donde los dos
documentos se contradicen, este manda sobre lo que ya está construido.

---

## 1. Backend — .NET 10, monolito modular

Fuente: `backend/CSH.slnx`, `CSH.Host/Program.cs`, `CSH.Usuarios/`, `CSH.Shared/`.

Hoy existen tres proyectos y **un solo módulo de negocio** (`CSH.Usuarios`) con
**una sola feature** (`ObtenerPerfil`).

```mermaid
flowchart TB
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef modulo fill:#34d399,color:#0b1220,stroke:#047857
    classDef shared fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef externo fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef datos fill:#f59e0b,color:#0b1220,stroke:#b45309

    SPA["SPA React (wwwroot / Vite :5173)"]:::cliente
    Movil["Cliente movil (contrato listo, app no existe)"]:::cliente

    subgraph Host["CSH.Host — composicion y pipeline"]
        Pipeline["UseExceptionHandler -> Authentication -> Authorization<br/>DefaultFiles + StaticFiles"]:::host
        Health["GET /healthz (anonimo)"]:::host
        AuthEP["AuthEndpoints<br/>GET /api/auth/login · POST /api/auth/logout"]:::host
        Fallback["MapFallbackToFile index.html"]:::host
        CU["CurrentUser : ICurrentUser<br/>unica clase que toca HttpContext"]:::host
        Migr["Migraciones.AplicarMigraciones()<br/>pg_advisory_lock(727) al arrancar"]:::host
    end

    subgraph Usuarios["CSH.Usuarios — vertical slice"]
        Endpoint["ObtenerPerfilEndpoint<br/>GET /api/me · RequireAuthorization"]:::modulo
        Handler["ObtenerPerfilHandler<br/>crea el perfil en el primer acceso"]:::modulo
        Repo["UsuariosRepository : IUsuariosRepository"]:::modulo
        Ctx["UsuariosDbContext (schema usuarios)"]:::modulo
        Svc["UsuariosService : IUsuariosService"]:::modulo
        Dom["Usuario (dominio, setters privados)"]:::modulo
    end

    subgraph Shared["CSH.Shared — sin dependencias a modulos"]
        ICU["ICurrentUser"]:::shared
        IUS["IUsuariosService + UsuarioDto"]:::shared
        Res["Result de T · Error · ToHttp()"]:::shared
    end

    Cognito["AWS Cognito<br/>user pool"]:::externo
    PG[("PostgreSQL")]:::datos

    SPA -->|"cookie csh_session"| Pipeline
    Movil -->|"Authorization: Bearer"| Pipeline
    Pipeline --> Health
    Pipeline --> AuthEP
    Pipeline --> Endpoint
    Pipeline --> Fallback

    AuthEP <-->|"OIDC code + PKCE"| Cognito
    Pipeline -.->|"valida firma / issuer"| Cognito

    Pipeline --> CU
    CU -.implementa.-> ICU
    Endpoint --> Handler
    Handler --> ICU
    Handler --> Repo --> Ctx --> PG
    Handler --> Dom
    Handler -->|"Result de UsuarioDto"| Res
    Res --> Endpoint
    Svc -.implementa.-> IUS
    Svc --> Repo
    Migr --> PG
```

### Selección de esquema de autenticación

Fuente: `CSH.Host/Auth/AuthServiceCollectionExtensions.cs`. El policy scheme
`CookieOrBearer` decide por request mirando el header `Authorization`.

```mermaid
flowchart LR
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef logica fill:#34d399,color:#0b1220,stroke:#047857

    Req["Request"]:::cliente
    Sel{"CookieOrBearer<br/>ForwardDefaultSelector"}:::host
    Cookie["Cookie csh_session<br/>HttpOnly · SameSite=Lax · 8h sliding"]:::host
    Bearer["JwtBearer<br/>ValidateAudience = false<br/>ValidIssuers = [Authority]"]:::host
    OIDC["OpenIdConnect (Cognito)<br/>code + PKCE · SaveTokens = false"]:::host
    Principal["ClaimsPrincipal<br/>name=email · role=cognito:groups"]:::host
    CU["ICurrentUser"]:::host
    Pol["Policies: administrativos · socios"]:::logica
    H["Handlers"]:::logica

    Req --> Sel
    Sel -->|"header empieza con Bearer "| Bearer
    Sel -->|"cualquier otro caso"| Cookie
    OIDC -->|"/signin-oidc emite la cookie"| Cookie
    Cookie --> Principal
    Bearer --> Principal
    Principal --> CU --> H
    Principal --> Pol --> H
```

Detalle que vale registrar: `OnRedirectToLogin` devuelve **401** en vez de
redirigir cuando la ruta empieza con `/api`, y **403** en access denied. Por eso
la SPA puede llamar `/api/me` sin sesión y tratar el 401 como "no logueado".

### Flujo real de `GET /api/me`

```mermaid
sequenceDiagram
    autonumber
    participant SPA as SPA (apiFetch)
    participant EP as ObtenerPerfilEndpoint
    participant H as ObtenerPerfilHandler
    participant CU as ICurrentUser
    participant R as UsuariosRepository
    participant DB as usuarios.usuario

    SPA->>EP: GET /api/me (cookie)
    EP->>H: Handle(ct)
    H->>CU: IsAuthenticated / Id (sub) / Email / Roles
    alt No autenticado
        H-->>EP: Error.Forbidden
        EP-->>SPA: 403 ProblemDetails
    else Autenticado
        H->>R: BuscarPorId(sub)
        alt Primer acceso
            R-->>H: null
            H->>R: ObtenerOInsertar(Usuario.Registrar(...))
            R->>DB: INSERT
            Note over R,DB: DbUpdateException -> detach y relee<br/>(carrera por unique en Id/Email)
        end
        H->>R: RegistrarAcceso + GuardarCambios
        R->>DB: UPDATE UltimoAccesoEn
        H-->>EP: Result.Ok(UsuarioDto)
        EP-->>SPA: 200 { id, email, nombre, numeroSocio, isAdmin, roles }
    end
```

---

## 2. Frontend — React 19 + Vite

Fuente: `frontend/`. Sin router, sin gestor de estado, sin librería de datos:
una sola pantalla (`App.tsx`) con `useState` + `useEffect`.

```mermaid
flowchart TB
    classDef entry fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef comp fill:#34d399,color:#0b1220,stroke:#047857
    classDef util fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef build fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef api fill:#f472b6,color:#0b1220,stroke:#be185d

    Html["index.html<br/>#root + meta app-version"]:::entry
    Main["main.tsx<br/>StrictMode · falla explicito si no hay #root"]:::entry
    App["App.tsx<br/>estado del healthz y de la sesion"]:::comp
    Loading["shared/components/LoadingBlock"]:::comp
    Css["index.css"]:::comp

    Api["shared/utils/api.ts — apiFetch<br/>unico fetch del front<br/>ApiResult = ok | error"]:::util
    Tag["shared/utils/buildTag.ts<br/>formatBuildTag -> v0.3-c021d8c"]:::util

    Vite["vite.config.ts<br/>alias @ -> src<br/>define __BUILD_TAG__<br/>plugin csh-build-tag-meta"]:::build
    Out["build outDir<br/>backend/src/CSH.Host/wwwroot"]:::build

    Proxy["dev proxy :5173<br/>/api · /healthz · /signin-oidc · /signout-callback-oidc<br/>-> VITE_API_TARGET (127.0.0.1:5080)"]:::api
    Backend["CSH.Host"]:::api

    Html --> Main --> App
    App --> Loading
    App --> Css
    App --> Api
    Api -->|"credentials: include"| Proxy --> Backend
    Backend -.->|"ProblemDetails RFC 9457"| Api
    Tag --> Vite --> Out
    Vite --> Proxy
    Vite -.->|"__BUILD_TAG__"| App
```

### Contrato HTTP que el front asume

```mermaid
flowchart LR
    classDef ok fill:#34d399,color:#0b1220,stroke:#047857
    classDef err fill:#f472b6,color:#0b1220,stroke:#be185d

    F["fetch"]:::ok
    R204["204"]:::ok
    R2xx["2xx con JSON"]:::ok
    Rerr["4xx/5xx"]:::err
    Rnet["throw de red"]:::err

    OK1["{ ok: true, value: undefined }"]:::ok
    OK2["{ ok: true, value: T }"]:::ok
    E1["{ ok:false, status, title, detail, errors? }"]:::err
    E2["{ ok:false, status: 0, 'Sin conexion' }"]:::err

    F --> R204 --> OK1
    F --> R2xx --> OK2
    F --> Rerr --> E1
    F --> Rnet --> E2
```

En `App.tsx` el 401 de `/api/me` se trata aparte: no es error visible, es
"no hay sesión" y se muestra el botón de login.

---

## 3. Base de datos

Fuente: `CSH.Usuarios/Infrastructure/` + migración `20260819204838_Init`.
Un esquema por módulo; hoy existe **un** esquema con **una** tabla.

```mermaid
erDiagram
    usuario {
        uuid Id PK "sub de Cognito, no autogenerado"
        varchar_256 Email "NOT NULL, UNIQUE (IX_usuario_Email)"
        varchar_128 Nombre "NOT NULL"
        varchar_32 NumeroSocio "NULL — custom:numero_socio"
        timestamptz CreadoEn "NOT NULL"
        timestamptz UltimoAccesoEn "NOT NULL"
    }
```

```mermaid
flowchart TB
    classDef schema fill:#f59e0b,color:#0b1220,stroke:#b45309
    classDef tabla fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef futuro fill:#e5e7eb,color:#374151,stroke:#9ca3af,stroke-dasharray: 4 3
    classDef proc fill:#a78bfa,color:#0b1220,stroke:#6d28d9

    subgraph PG["PostgreSQL 16 — una base por ambiente"]
        subgraph SU["schema usuarios"]
            T1["usuario"]:::tabla
            H1["__EFMigrationsHistory"]:::tabla
        end
        SF1["schema entradas (no existe)"]:::futuro
        SF2["schema membresias (no existe)"]:::futuro
        SF3["schema parqueo, cuponera, ... (no existen)"]:::futuro
    end

    Arranque["CSH.Host arranca"]:::proc
    Lock["pg_advisory_lock(727)"]:::proc
    Mig["UsuariosDbContext.MigrateAsync()"]:::proc
    Unlock["pg_advisory_unlock(727)"]:::proc

    Arranque --> Lock --> Mig --> Unlock
    Mig --> SU
    Mig -.->|"MigrationsHistoryTable en el schema del modulo"| H1
```

El lock serializa el arranque: con varias tasks Fargate subiendo a la vez, solo
una aplica la migración y las demás esperan.

**Ambientes:** cada ambiente tiene su propio cluster Aurora
(`infra/modules/datos`), con la clave del usuario maestro administrada por RDS
en Secrets Manager — nunca en el state de Terraform. En local, `docker-compose.dev.yml`
levanta `postgres:16-alpine` con base `csh_dev`.

---

## 4. Infraestructura AWS

Fuente: `infra/`. **El código es ECS Fargate, no EC2 + Auto Scaling Group.**
`diagramas.md` §5 todavía muestra ASG con warm pool y AMI horneada; eso quedó
desactualizado respecto a lo que hoy hace `terraform apply`.

```mermaid
flowchart TB
    classDef edge fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef computo fill:#34d399,color:#0b1220,stroke:#047857
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef soporte fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef ident fill:#60a5fa,color:#0b1220,stroke:#1d4ed8

    Internet["Internet"]:::edge
    WAF["WAFv2 REGIONAL — solo produccion<br/>AWSManagedRulesCommonRuleSet<br/>rate limit 2000 req/IP"]:::edge

    subgraph VPC["VPC csh-ambiente — 2 AZ · sin NAT Gateway"]
        subgraph Pub["Subredes publicas (cidrsubnet /24 x2)"]
            ALB["ALB<br/>:80 (redirige a :443 si hay cert)<br/>:443 TLS13-1-2"]:::edge
            TG["Target group ip :8080<br/>health /healthz cada 15s"]:::edge
            Tasks["ECS Fargate — servicio csh-ambiente<br/>awsvpc · assign_public_ip<br/>circuit breaker + rollback"]:::computo
        end
        subgraph Priv["Subredes privadas (cidrsubnet +100)"]
            Aurora[("Aurora PostgreSQL Serverless v2<br/>:5432 · storage_encrypted")]:::datos
        end
    end

    ECR["ECR csh — compartido por los 3 ambientes<br/>IMMUTABLE · scan on push"]:::soporte
    Secrets["Secrets Manager<br/>usuario/clave maestra (RDS managed)"]:::soporte
    SSM["SSM SecureString<br/>/csh-ambiente/cognito/bff-client-secret"]:::soporte
    Logs["CloudWatch Logs /ecs/csh-ambiente"]:::soporte
    Cognito["Cognito user pool<br/>grupos: administrativos(1) socios(10) invitados(100)<br/>clients: bff (secreto) · mobile (publico)"]:::ident
    AS["Application Auto Scaling<br/>ALBRequestCountPerTarget · CPU · Memoria<br/>+ scheduled actions (agenda)"]:::computo

    Internet --> WAF --> ALB --> TG --> Tasks
    Tasks -->|"5432, solo desde SG app"| Aurora
    Tasks -->|"pull imagen"| ECR
    Tasks -->|"DB_USUARIO / DB_CLAVE"| Secrets
    Tasks -->|"Cognito__BffClientSecret"| SSM
    Tasks --> Logs
    Tasks <-->|"OIDC / JWKS"| Cognito
    AS -.->|"DesiredCount"| Tasks
```

### Cadena de security groups

```mermaid
flowchart LR
    classDef sg fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    I["0.0.0.0/0"]:::sg
    A["sg alb<br/>in 80, 443"]:::sg
    B["sg app<br/>in 8080 SOLO referenciando sg alb<br/>out 0.0.0.0/0 (ECR, Secrets, logs)"]:::sg
    C["sg base<br/>in 5432 SOLO referenciando sg app"]:::sg
    I --> A --> B --> C
```

Las tasks tienen IP pública (no hay NAT Gateway, decisión de costo), pero el
security group solo acepta entrada desde el ALB.

### Composición de módulos Terraform

```mermaid
flowchart TB
    classDef st fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef mod fill:#34d399,color:#0b1220,stroke:#047857
    classDef back fill:#a78bfa,color:#0b1220,stroke:#6d28d9

    S3["Backend S3 antonyproyects + lock DynamoDB csh-terraform-locks<br/>(creados a mano, fuera de Terraform)"]:::back

    C["ambientes/comun<br/>csh/comun/terraform.tfstate"]:::st
    D["ambientes/dev — 10.10.0.0/16<br/>ACU 0.5-1 · 1-2 tasks · backup 1d"]:::st
    P["ambientes/pruebas — 10.20.0.0/16<br/>ACU 0.5-2 · 1-3 tasks · backup 7d"]:::st
    R["ambientes/produccion — 10.30.0.0/16<br/>ACU 0.5-8 · 2-10 tasks · backup 14d<br/>WAF + deletion protection + advanced security"]:::st

    MA["modules/ambiente"]:::mod
    MR["modules/red"]:::mod
    MD["modules/datos"]:::mod
    MI["modules/identidad"]:::mod
    MC["modules/computo"]:::mod
    MG["modules/registro (ECR)"]:::mod

    S3 -.-> C
    S3 -.-> D
    S3 -.-> P
    S3 -.-> R

    C --> MG
    D --> MA
    P --> MA
    R --> MA
    MA --> MR
    MA --> MD
    MA --> MI
    MA --> MC
    MA -.->|"data aws_ecr_repository (por nombre, no por state)"| MG
    MR -->|"subredes, SGs"| MD
    MR -->|"subredes, SGs"| MC
    MD -->|"endpoint, secreto_arn"| MC
    MI -->|"authority, dominio, client ids"| MC
```

---

## 5. CI/CD

Fuente: `.github/workflows/`. Hay dos caminos de deploy que **no comparten
artefacto**: `dev` despliega la imagen .NET nueva por Podman; `main` sigue
desplegando la app Node vieja por systemd.

```mermaid
flowchart TB
    classDef issue fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef rama fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef ci fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef deploy fill:#34d399,color:#0b1220,stroke:#047857
    classDef alerta fill:#a78bfa,color:#0b1220,stroke:#6d28d9

    Issue["issue-userstory.yml / issue-lifecycle.yml<br/>issue -> user story -> board"]:::issue
    Feature["rama feature"]:::rama
    PRdev["PR a dev"]:::ci

    subgraph CI["ci.yml — PR y push a dev/main"]
        DR["dependency-review<br/>fail-on-severity: high (solo PR)"]:::ci
        BE["backend: restore · build Release · test<br/>TreatWarningsAsErrors"]:::ci
        FE["frontend: oxlint · tsc -b · vitest · vite build"]:::ci
        HC["health-check: build SPA -> wwwroot,<br/>dotnet publish, arranca, cURL /healthz + SPA"]:::ci
        NF["notify Discord si algo falla"]:::alerta
    end

    Dev["dev"]:::rama
    Main["main"]:::rama
    PRmain["PR dev -> main"]:::ci

    Issue --> Feature --> PRdev --> CI
    CI --> Dev
    Dev --> PRmain --> CI --> Main

    Dev ==> DDev["deploy-dev.yml"]:::deploy
    Main ==> DProd["deploy.yml"]:::deploy
    RB["rollback.yml — workflow_dispatch"]:::deploy
    DProd -.->|"si falla / manual"| RB
```

### `deploy-dev.yml` — push a `dev`

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub Actions (ubuntu-latest)
    participant SEC as secrets.ALL_SECRETS
    participant NG as Tunel ngrok
    participant SRV as Servidor (podman)
    participant DC as Discord

    GH->>SEC: parsea NGROK_HOST/PORT, DEPLOY_USER, DEPLOY_SSH_KEY_B64
    GH->>NG: ssh -p NGROK_PORT
    NG->>SRV: sesion
    SRV->>SRV: git fetch origin dev + git archive SHA -> dir temporal limpio
    SRV->>SRV: podman build -f cicd/Containerfile<br/>--build-arg APP_VERSION=dev COMMIT_SHA=SHA
    Note over SRV: multi-stage: node:20 (SPA -> wwwroot)<br/>-> sdk:10.0 (publish) -> aspnet:10.0 (USER $APP_UID)
    SRV->>SRV: podman rm -f csh-dev-1421 && podman run -d -p 1421:8080
    loop hasta 30 intentos, 2s
        SRV->>SRV: curl 127.0.0.1:1421/healthz
    end
    alt OK
        SRV->>SRV: podman image prune -f
        SRV-->>GH: exit 0
    else Falla
        SRV->>SRV: podman logs --tail 100
        SRV-->>GH: exit 1
    end
    GH->>DC: aviso con dev-<short sha> y URL herediano-dev.milocalhost.work
```

### `deploy.yml` — push a `main` (stack Node, todavía)

```mermaid
flowchart LR
    classDef paso fill:#34d399,color:#0b1220,stroke:#047857
    classDef alerta fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef fs fill:#fbbf24,color:#0b1220,stroke:#b45309

    Push["push a main"]:::paso
    D1["Discord: empieza"]:::alerta
    Ver["version = max(release 0.N) + 1<br/>(gh release list)"]:::paso
    Scp["scp app.env -> shared/.env (chmod 600)"]:::paso
    Arch["git archive SHA -> releases/0.N<br/>rechaza si el directorio ya existe"]:::fs
    Bld["npm ci && APP_VERSION/COMMIT_SHA npm run build"]:::paso
    Man["RELEASE_MANIFEST.json"]:::fs
    Ln["ln -sfn releases/0.N current"]:::fs
    Sys["systemd --user csh.service<br/>restart · WorkingDirectory=current"]:::paso
    HC["curl 127.0.0.1:8088/healthz (30 x 2s)"]:::paso
    Rel["GitHub release marker 0.N"]:::paso
    D2["Discord: resultado"]:::alerta
    RB["rollback.yml: elige release previo<br/>y reapunta el symlink current"]:::paso

    Push --> D1 --> Ver --> Scp --> Arch --> Bld --> Man --> Ln --> Sys --> HC --> Rel --> D2
    HC -.->|"falla"| RB
```

Estructura en el servidor de producción:

```mermaid
flowchart TB
    classDef fs fill:#fbbf24,color:#0b1220,stroke:#b45309
    Root["/home/tony/Desktop/APP_CSH"]:::fs
    Src["source/ — checkout solo para fetch"]:::fs
    Sh["shared/.env — 600, lo escribe cada deploy"]:::fs
    Rel["releases/0.3, 0.4, 0.5 ... (inmutables)"]:::fs
    Cur["current -> releases/0.N (symlink)"]:::fs
    Svc["csh.service :8088 (WorkingDirectory=current)"]:::fs

    Root --> Src
    Root --> Sh
    Root --> Rel
    Root --> Cur --> Rel
    Svc --> Cur
    Svc --> Sh
```

---

## 6. Brechas entre el código y `diagramas.md`

| Tema | `diagramas.md` (destino) | Lo que hay en el código |
|---|---|---|
| Módulos de negocio | 10 (`Entradas`, `Parqueo`, `Membresias`, `Red`, …) | 1: `CSH.Usuarios`, con la feature `ObtenerPerfil` |
| Cómputo AWS | EC2 + ASG + warm pool + AMI horneada | ECS Fargate + Application Auto Scaling (sin warm pool) |
| DR segunda región | Aurora Global, Route53 failover, CRR de S3 | no existe: un solo `region = us-east-1` por ambiente |
| Route53 / dominio | en el diagrama | no hay recurso Route53; el ALB expone su DNS y el cert es opcional (`certificado_arn`) |
| S3 de estáticos | en el diagrama | no existe: la SPA se sirve desde `wwwroot` dentro del contenedor |
| Deploy de producción | bake de AMI + instance refresh | `main` sigue en el stack Node con systemd y symlinks |
| Comunicación por eventos | `mediator.Publish` de `EntradaCompradaEvent` | no hay mediator ni eventos; solo el contrato `IUsuariosService` |
| Stripe, WhatsApp, correo, Aruba | integraciones del contexto | ninguna referencia en el código |
| Frontend por bounded context | diagrama vacío en §4 | una pantalla, sin router ni store |
