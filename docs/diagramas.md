# Diagramas

Mermaid. Describen el **estado destino** del proyecto: monolito modular .NET 10 +
React 19 (ver [`harness_DEV.md`](harness_DEV.md)) desplegado sobre AWS con DR en
una segunda región (ver [`infra.md`](infra.md)).

Lo que corre hoy (app Node/Express sobre túnel ngrok) está al final, en
[§7 Estado actual](#7-estado-actual-transitorio), marcado como transitorio.

Se actualizan en cada move de `dev` a `main`. Issue relacionado:
[#45](https://github.com/S3-Simple-Software-Solutions/CSH/issues/45).

---

## 1. Contexto — quién usa la plataforma y con qué habla

```mermaid
flowchart LR
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef app fill:#34d399,color:#0b1220,stroke:#047857
    classDef externo fill:#f472b6,color:#0b1220,stroke:#be185d

    Aficionado[Aficionado / socio]:::cliente
    Taquilla[Taquilla y puerta]:::cliente
    Comercial[Comercial y prensa]:::cliente
    Local[Concesionario del estadio]:::cliente

    CSH[Plataforma CSH]:::app

    Stripe[Stripe - pagos]:::externo
    Correo[Correo transaccional]:::externo
    WhatsApp[WhatsApp - Twilio]:::externo
    Discord[Discord - avisos de deploy]:::externo

    Aficionado --> CSH
    Taquilla --> CSH
    Comercial --> CSH
    Local --> CSH

    CSH --> Stripe
    CSH --> Correo
    CSH --> WhatsApp
    CSH --> Discord
```

---

## 2. Arquitectura de la solución — monolito modular

Un solo proceso desplegable con **dos clientes**: la SPA del sitio y la app
móvil. Cada bounded context es un `.csproj` separado: el compilador enforcea los
límites. `CSH.Host` es lo único que conoce HTTP — compone los módulos, autentica
y traduce errores a Problem Details.

```mermaid
flowchart TB
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef modulo fill:#34d399,color:#0b1220,stroke:#047857
    classDef datos fill:#f59e0b,color:#0b1220,stroke:#b45309

    SPA["ClientApp - React 19 + Vite (mismo origen)"]:::cliente
    Movil["App movil (otro origen)"]:::cliente

    Host["CSH.Host - composicion, autenticacion, ProblemDetails, CORS"]:::host

    Usuarios[CSH.Usuarios]:::modulo
    Entradas[CSH.Entradas]:::modulo
    Parqueo[CSH.Parqueo]:::modulo
    Restaurantes[CSH.Restaurantes]:::modulo
    Cuponera[CSH.Cuponera]:::modulo

    DB[(PostgreSQL - un esquema por modulo)]:::datos

    SPA -->|"/api - cookie de sesion"| Host
    Movil -->|"/api - token bearer"| Host

    Host --> Usuarios
    Host --> Entradas
    Host --> Parqueo
    Host --> Restaurantes
    Host --> Cuponera

    Usuarios --> DB
    Entradas --> DB
    Parqueo --> DB
    Restaurantes --> DB
    Cuponera --> DB
```

Los cinco módulos referencian `CSH.Shared` — `Result<T>`, `Error`,
`ICurrentUser`, contratos y eventos. No está dibujado a propósito: sería una
arista desde cada módulo hacia el mismo nodo y no agrega información. La regla
la dice mejor en una línea: **todos dependen de Shared y Shared no depende de
nadie.**

### El móvil no cambia los módulos, cambia el borde

Los handlers reciben `ICurrentUser` y no saben por dónde entró la request. Por
eso agregar un cliente móvil no toca ningún módulo: se agrega un esquema de
autenticación en `CSH.Host` y ambos terminan en el mismo `ClaimsPrincipal`.

```mermaid
flowchart LR
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef logica fill:#34d399,color:#0b1220,stroke:#047857

    SPA[ClientApp]:::cliente
    Movil[App movil]:::cliente

    Cookie["Esquema cookie - ASP.NET Core"]:::host
    Bearer["Esquema bearer - token corto + refresh revocable"]:::host
    Principal[ClaimsPrincipal]:::host
    CU["ICurrentUser - unica clase que toca HttpContext"]:::host
    Handlers["Handlers de los modulos"]:::logica

    SPA -->|"Set-Cookie"| Cookie --> Principal
    Movil -->|"Authorization: Bearer"| Bearer --> Principal
    Principal --> CU --> Handlers
```

Lo que sí cambia al entrar el móvil:

- **La decisión de auth se reabre.** `harness_DEV_backend.md` §6 eligió cookie
  sobre JWT y dejó anotado que una app móvil sería lo que cambiara esa decisión.
  La cookie se queda para la web; el móvil necesita bearer.
- **La revocación no se negocia.** El motivo de haber descartado JWT era poder
  cortar acceso ya (cuenta comprometida, fraude en una apertura de venta). Ese
  motivo sigue vivo: el token del móvil va corto y el refresh se revoca contra
  la base — no un JWT largo sin punto de corte.
- **CORS deja de ser trivial.** Hoy la SPA es mismo origen y no hay política que
  mantener; el móvil obliga a una lista explícita de orígenes y métodos.
- **El contrato de la API pasa a ser público.** Una app instalada no se
  actualiza cuando uno hace deploy: hay que versionar (`/api/v1`), publicar
  OpenAPI y dejar de romper endpoints sin período de convivencia.
- **Cambio de alcance formal.** El acta §5 tiene las apps móviles nativas
  *fuera* de alcance; entra por control de cambios (acta §15).

### Dentro de un módulo — vertical slices

```mermaid
flowchart LR
    classDef http fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef logica fill:#34d399,color:#0b1220,stroke:#047857
    classDef infra fill:#fbbf24,color:#0b1220,stroke:#b45309

    Req[HTTP request]:::http
    Endpoint[Endpoint - ruta, authz, mapeo]:::http
    Handler[Handler - toda la logica de negocio]:::logica
    Repo[Repositorio - EF Core, sin logica]:::infra
    DB[(Esquema del modulo)]:::infra
    Resp[200/201/204 o ProblemDetails]:::http

    Req --> Endpoint --> Handler --> Repo --> DB
    Handler -->|"Result de T"| Endpoint --> Resp
```

---

## 3. Comunicación entre módulos

Dos patrones, nunca una referencia directa entre módulos.

```mermaid
flowchart LR
    classDef modulo fill:#34d399,color:#0b1220,stroke:#047857
    classDef shared fill:#fbbf24,color:#0b1220,stroke:#b45309

    subgraph Caso1["Caso 1 - query sincronica obligatoria"]
        direction LR
        E1[CSH.Entradas]:::modulo
        I1[IUsuariosService - en CSH.Shared]:::shared
        U1[CSH.Usuarios - implementa]:::modulo
        E1 -->|inyecta| I1
        U1 -.implementa.-> I1
    end

    subgraph Caso2["Caso 2 - evento desacoplado"]
        direction LR
        E2[CSH.Entradas]:::modulo
        Ev[EntradaCompradaEvent - en CSH.Shared]:::shared
        U2[CSH.Usuarios - handler]:::modulo
        C2[CSH.Cuponera - handler]:::modulo
        E2 -->|"mediator.Publish"| Ev
        Ev --> U2
        Ev --> C2
    end
```

---

## 4. Frontend — espeja los bounded contexts

```mermaid
flowchart TB
    classDef spa fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef comun fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef api fill:#34d399,color:#0b1220,stroke:#047857

    Main[main.tsx - router]:::spa
    ModEntradas[modules/entradas]:::spa
    ModParqueo[modules/parqueo]:::spa
    ModUsuarios[modules/usuarios]:::spa
    SharedFe[shared/ - components, hooks]:::comun
    ApiFetch[shared/utils/api.ts - apiFetch, unico fetch]:::comun
    Backend["/api - CSH.Host"]:::api

    Main --> ModEntradas
    Main --> ModParqueo
    Main --> ModUsuarios

    ModEntradas --> SharedFe
    ModParqueo --> SharedFe
    ModUsuarios --> SharedFe

    ModEntradas -->|api.ts| ApiFetch
    ModParqueo -->|api.ts| ApiFetch
    ModUsuarios -->|api.ts| ApiFetch
    ApiFetch --> Backend
```

---

## 5. Infraestructura destino — AWS región primaria ("blue")

Corresponde a [`infra.md` §Decisiones](infra.md). Sin NAT Gateway: las instancias
viven en subred pública y el security group solo acepta tráfico del ALB.

```mermaid
flowchart TB
    classDef edge fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef computo fill:#34d399,color:#0b1220,stroke:#047857
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef soporte fill:#a78bfa,color:#0b1220,stroke:#6d28d9

    Usuario[Aficionado]:::edge
    R53[Route53 - failover routing]:::edge
    WAF[WAF - bots en apertura de venta]:::edge
    ALB[Application Load Balancer]:::edge

    subgraph Primaria["AWS region primaria - 2 AZ"]
        ASG[Auto Scaling Group - EC2 desde AMI horneada]:::computo
        Warm[Warm Pool - instancias Stopped]:::computo
        Aurora[(Aurora PostgreSQL Serverless v2)]:::datos
        S3[S3 - estaticos y assets]:::datos
        Secrets[Secrets Manager]:::soporte
    end

    Usuario --> R53 --> WAF --> ALB --> ASG
    Warm -.->|"scale-out: pico de venta"| ASG
    ASG -.->|scale-in| Warm
    ASG --> Aurora
    ASG --> S3
    ASG --> Secrets
```

### Cómo escala en una apertura de venta

```mermaid
flowchart LR
    classDef trigger fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef accion fill:#34d399,color:#0b1220,stroke:#047857

    Agenda[Apertura de venta conocida]:::trigger
    Sched[Scheduled scaling - previo al evento]:::accion
    Target[Target tracking - CPU y requests por instancia]:::accion
    Inesperado[Pico no anticipado]:::trigger
    WarmPool[Warm Pool - arranque rapido]:::accion
    Capacidad[Capacidad servida]:::accion

    Agenda --> Sched --> WarmPool --> Capacidad
    Inesperado --> Target --> WarmPool
```

---

## 6. DR — segunda región AWS ("green"), opción recomendada

Cubre una interrupción regional de AWS. Failover automático posible; **failback
siempre manual**, por riesgo de conflicto de escrituras.

```mermaid
flowchart TB
    classDef edge fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef prim fill:#34d399,color:#0b1220,stroke:#047857
    classDef dr fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309

    R53[Route53 + health checks]:::edge

    subgraph Blue["Region primaria - blue"]
        ALB1[ALB]:::prim
        ASG1[ASG + Warm Pool]:::prim
        AuroraW[(Aurora Global - writer)]:::datos
        S3A[(S3)]:::datos
        SecA[Secrets Manager]:::prim
    end

    subgraph Green["Region DR - green"]
        ALB2[ALB]:::dr
        ASG2[ASG + Warm Pool - capacidad minima]:::dr
        AuroraR[(Aurora Global - secundaria, lag aprox 1s)]:::datos
        S3B[(S3)]:::datos
        SecB[Secrets - replica multi-region]:::dr
    end

    R53 -->|primario| ALB1 --> ASG1 --> AuroraW
    R53 -.->|"failover automatico"| ALB2 --> ASG2 --> AuroraR

    AuroraW ==>|"replicacion de storage - propaga DDL"| AuroraR
    S3A ==>|Cross-Region Replication| S3B
    SecA ==>|replica nativa| SecB
    ASG1 -.->|"AMI copiada por EC2 Image Builder"| ASG2
    AuroraR -.->|"failback SIEMPRE manual"| AuroraW
```

---

## 7. CI/CD

Flujo del harness: la feature va a `dev`, `dev` despliega solo, y únicamente
`dev` abre PR a `main`. Todo deploy anuncia versión, cambios y URL
([`harness.md` §10](harness.md)).

```mermaid
flowchart LR
    classDef issue fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef rama fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef ci fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef deploy fill:#34d399,color:#0b1220,stroke:#047857

    Issue[Issue / user story]:::issue
    Feature[Rama feature]:::rama
    PRdev[PR a dev]:::ci
    CI["CI: dotnet build + test, typecheck, vitest, build front"]:::ci
    Dev[dev]:::rama
    DeployDev[Deploy dev - herediano-dev]:::deploy
    PRmain[PR dev a main]:::ci
    Main[main]:::rama
    Bake[Bake de AMI por release]:::deploy
    Refresh[Instance refresh del ASG]:::deploy
    Prod[Produccion]:::deploy
    Rollback[Rollback - Launch Template anterior]:::deploy
    Aviso[Aviso Discord - version, cambios, URL]:::deploy

    Issue --> Feature --> PRdev --> CI --> Dev --> DeployDev --> Aviso
    Dev --> PRmain --> CI
    PRmain --> Main --> Bake --> Refresh --> Prod --> Aviso
    Prod -.->|falla| Rollback
```

---

## 8. Flujo crítico — compra de entrada

El punto donde se concentra el riesgo del proyecto: dos aficionados peleando la
misma butaca en una apertura de venta, más el webhook de Stripe que puede llegar
duplicado o antes que la redirección del usuario.

```mermaid
sequenceDiagram
    autonumber
    actor A as Aficionado
    participant SPA as ClientApp
    participant EP as Endpoint
    participant H as ComprarEntradaHandler
    participant DB as PostgreSQL
    participant S as Stripe

    A->>SPA: Elige butaca
    SPA->>EP: POST /api/entradas/comprar
    EP->>H: Handle(request)
    H->>DB: Reserva la butaca (UPDATE condicional / rowversion)
    alt Butaca ya tomada
        DB-->>H: 0 filas afectadas
        H-->>EP: Error.Conflict
        EP-->>SPA: 409 ProblemDetails
        SPA-->>A: "Esa butaca ya se vendio"
    else Reserva ganada
        DB-->>H: OK - reserva con vencimiento
        H->>S: Crea intento de pago
        S-->>SPA: Checkout
        A->>S: Paga
        S-->>EP: Webhook (idempotente por event id)
        EP->>DB: Confirma entrada y emite QR
        EP-->>SPA: Entrada confirmada
    end
```

---

## 9. Estado actual (transitorio)

Lo que está corriendo hoy, **antes** de la reconstrucción: app Node/Express
servida por systemd, expuesta por un túnel ngrok hacia el runner self-hosted.
Este diagrama existe para saber de dónde salimos; desaparece cuando el destino
de §5 esté en pie.

```mermaid
flowchart LR
    classDef edge fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef prod fill:#34d399,color:#0b1220,stroke:#047857
    classDef dev fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309

    GH[GitHub Actions]:::edge
    Tunnel[Tunel ngrok]:::edge
    Runner[Runner self-hosted]:::edge
    Prod["csh.service - puerto 8088"]:::prod
    DevEnv["csh-dev.service - puerto 1421"]:::dev
    Nginx[Nginx + Cloudflare tunnel]:::edge
    DB[(herediano-postgres - 5441)]:::datos

    GH --> Tunnel --> Runner
    Runner --> Prod
    Runner --> DevEnv
    Nginx --> Prod
    Nginx --> DevEnv
    Prod --> DB
    DevEnv --> DB
```

**Riesgos vigentes de este montaje** (ver acta §12): el túnel ngrok como
dependencia del despliegue (R8), y la separación de bases de datos entre
ambientes (R1), hoy resuelta solo parcialmente vía `DATABASE_URL_DEV`.
