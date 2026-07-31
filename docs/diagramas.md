# Diagramas

Estado destino: monolito modular .NET 10 + React 19 ([`harness_DEV.md`](harness_DEV.md))
sobre AWS con DR en segunda región ([`infra.md`](infra.md)). Se actualizan en cada
move de `dev` a `main`. Issue: [#45](https://github.com/S3-Simple-Software-Solutions/CSH/issues/45).

---

## 1. Contexto

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

```mermaid
flowchart TB
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef modulo fill:#34d399,color:#0b1220,stroke:#047857
    classDef datos fill:#f59e0b,color:#0b1220,stroke:#b45309

    SPA["ClientApp - React 19 + Vite (mismo origen)"]:::cliente
    Movil["App movil del aficionado - React Native/Expo (otro origen)"]:::cliente

    Host["CSH.Host - composicion, autenticacion, ProblemDetails, CORS"]:::host

    Usuarios[CSH.Usuarios]:::modulo
    Entradas[CSH.Entradas]:::modulo
    Parqueo[CSH.Parqueo]:::modulo
    Restaurantes[CSH.Restaurantes]:::modulo
    Cuponera[CSH.Cuponera]:::modulo
    Membresias["CSH.Membresias - socios, cuota, carne QR"]:::modulo
    Red["CSH.Red - portal cautivo del estadio"]:::modulo

    DB[(PostgreSQL - un esquema por modulo)]:::datos

    SPA -->|"/api - cookie de sesion"| Host
    Movil -->|"/api - token bearer"| Host

    Host --> Usuarios
    Host --> Entradas
    Host --> Parqueo
    Host --> Restaurantes
    Host --> Cuponera
    Host --> Membresias
    Host --> Red

    Usuarios --> DB
    Entradas --> DB
    Parqueo --> DB
    Restaurantes --> DB
    Cuponera --> DB
    Membresias --> DB
    Red --> DB
```

### Autenticación por tipo de cliente

```mermaid
flowchart LR
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef host fill:#a78bfa,color:#0b1220,stroke:#6d28d9
    classDef logica fill:#34d399,color:#0b1220,stroke:#047857

    SPA[ClientApp]:::cliente
    Movil["App movil - Expo"]:::cliente

    Cookie["Esquema cookie - ASP.NET Core"]:::host
    Bearer["Esquema bearer - token corto + refresh revocable"]:::host
    Principal[ClaimsPrincipal]:::host
    CU["ICurrentUser - unica clase que toca HttpContext"]:::host
    Handlers["Handlers de los modulos"]:::logica

    SPA -->|"Set-Cookie"| Cookie --> Principal
    Movil -->|"Authorization: Bearer"| Bearer --> Principal
    Principal --> CU --> Handlers
```

### Dentro de un módulo — vertical slice

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

### Contrato compartido con el móvil

```mermaid
flowchart LR
    classDef api fill:#34d399,color:#0b1220,stroke:#047857
    classDef comun fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8

    OpenAPI["OpenAPI de CSH.Host - /api/v1"]:::api
    Tipos["Tipos del dominio generados (compartidos)"]:::comun

    Web["ClientApp - componentes y CSS propios"]:::cliente
    Movil["App Expo - componentes nativos propios"]:::cliente

    FetchWeb["apiFetch - cookie de sesion"]:::comun
    FetchMovil["apiFetch - bearer + refresh"]:::comun

    OpenAPI --> Tipos
    Tipos --> Web
    Tipos --> Movil
    Web --> FetchWeb --> OpenAPI
    Movil --> FetchMovil --> OpenAPI
```

---

## 5. Infraestructura destino — AWS región primaria ("blue")

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

### Escalado en una apertura de venta

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

## 6. DR — segunda región AWS ("green")

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
