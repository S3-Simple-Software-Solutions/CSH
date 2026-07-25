# Diagramas

Mermaid, actualizados en cada move de `dev` a `main`. Issue relacionado: [#45](https://github.com/S3-Simple-Software-Solutions/CSH/issues/45).

## Arquitectura

```mermaid
flowchart LR
    classDef cliente fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef app fill:#34d399,color:#0b1220,stroke:#047857
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef externo fill:#f472b6,color:#0b1220,stroke:#be185d

    Usuario[Usuario]:::cliente
    Admin[Admin]:::cliente
    SPA[SPA React]:::app
    Server[Server Express]:::app
    DB[(PostgreSQL)]:::datos
    Stripe[Stripe]:::externo
    SMTP[SMTP]:::externo
    Discord[Discord]:::externo

    Usuario --> SPA
    Admin --> SPA
    SPA --> Server
    Server --> DB
    Server --> Stripe
    Server --> SMTP
    Server --> Discord
```

## Infraestructura

```mermaid
flowchart LR
    classDef edge fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef prod fill:#34d399,color:#0b1220,stroke:#047857
    classDef dev fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef datos fill:#fbbf24,color:#0b1220,stroke:#b45309

    Tunnel[Tunel ngrok]:::edge
    Runner[Runner self-hosted]:::edge
    Prod[current -> release]:::prod
    DevEnv[Podman app-csh-dev]:::dev
    DB[(PostgreSQL)]:::datos

    Tunnel --> Runner
    Runner --> Prod
    Runner --> DevEnv
    Prod --> DB
    DevEnv --> DB
```

## CI/CD

```mermaid
flowchart LR
    classDef issue fill:#f472b6,color:#0b1220,stroke:#be185d
    classDef rama fill:#60a5fa,color:#0b1220,stroke:#1d4ed8
    classDef ci fill:#fbbf24,color:#0b1220,stroke:#b45309
    classDef deploy fill:#34d399,color:#0b1220,stroke:#047857

    Issue[Issue]:::issue
    Historia[User story]:::issue
    Dev[dev]:::rama
    CI[Main Merge CI]:::ci
    Main[main]:::rama
    DeployDev[Deploy dev]:::deploy
    DeployProd[Deploy prod]:::deploy
    Rollback[Rollback]:::deploy

    Issue --> Historia --> Dev
    Dev --> DeployDev
    Dev --> CI --> Main
    Main --> DeployProd
    DeployProd -.-> Rollback
```
