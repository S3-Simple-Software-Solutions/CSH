# Infra en AWS + DR (propuesta)

Diseño de destino discutido para reemplazar el túnel ngrok actual (ver
`docs/diagramas.md` para la infra vigente). Presupuesto objetivo: hasta
$2000/mes. Todavía no implementado.

## Decisiones — AWS (primario, "blue")

- **Cómputo:** 1 Auto Scaling Group (EC2, 2 AZ) detrás de un ALB, con
  **Warm Pool** (`Stopped`) para absorber picos sin pagar el cómputo prendido
  y sin el arranque lento de una instancia fría.
  - Launch Template apunta a una AMI horneada por release en CI (sin `npm ci`/build en el boot).
  - **Scheduled scaling** antes de cada apertura de venta de boletos conocida.
  - **Target tracking** (CPU / requests por instancia del ALB) para lo no anticipado.
  - Scale-in devuelve instancias al warm pool en vez de terminarlas.
- **Base de datos:** Aurora PostgreSQL Serverless v2, instancias separadas
  dev/prod (resuelve la separación de ambientes pendiente del SOW).
- **Seguridad:** WAF en el ALB (riesgo de bots en la apertura de venta).
- **Sin NAT Gateway:** instancias con IP pública en subred pública, SG solo
  acepta entrada del ALB.

## DR — Opción recomendada: Full AWS (segunda región, "green")

Prioridad actual. El modo de falla más probable para esta app es una
interrupción regional de AWS, no una caída global de la plataforma — esta
opción cubre ese caso con menor carga operativa que un DR multi-nube, usando
servicios nativos de AWS hechos para esto en vez de replicación genérica
armada a mano.

- **Cómputo:** mismo patrón ASG + Warm Pool que en la región primaria,
  replicado en la región DR. La AMI se copia entre regiones automáticamente
  vía EC2 Image Builder (distribución multi-región).
- **Base de datos: Aurora Global Database** (Serverless v2 en la región
  secundaria). Replica a nivel de storage, así que los cambios de esquema
  (DDL) viajan solos — a diferencia de una réplica lógica genérica. Lag
  típico ~1 segundo; switchover/failover gestionado con un solo llamado de
  API.
- **Estáticos:** S3 **Cross-Region Replication**, nativo.
- **Secretos:** Secrets Manager **multi-region replica secrets**, nativo.
- **Failover:** Route53 con health checks + *failover routing policy* entre
  el ALB de cada región (o **Route53 Application Recovery Controller** para
  orquestación más formal con reglas de seguridad contra failover
  accidental).
- El failover hacia la región DR puede ser automático; el **failback hacia
  la región primaria es siempre manual** (riesgo de conflicto de datos si
  ambos lados llegaron a aceptar escrituras).
- Cubre: falla regional de AWS. No cubre: una falla que tumbe AWS entero, o
  un problema a nivel de la cuenta (fraude, suspensión).

### Costo — Full AWS (segunda región)

| Recurso | Costo/mes | Nota |
|---|---:|---|
| ASG + Warm Pool standby en región DR | ~$35 | Igual patrón que la región primaria, capacidad mínima |
| Aurora Global Database — secundaria Serverless v2 + I/O replicado | ~$70 | Incluye el cargo de "replicated write I/Os" de Aurora Global |
| S3 Cross-Region Replication | ~$3 | Storage duplicado + requests de replicación |
| Secrets Manager (replica multi-región) | ~$2 | |
| Route53 health checks + failover routing | ~$3 | |
| **Subtotal DR (2da región AWS)** | **≈ $113/mes** | |

## DR — Alternativa: Híbrido AWS + GCP (blue-green multi-nube)

Documentado por si en el futuro se necesita independencia total de
proveedor (protege también contra una falla que tumbe AWS entero, no solo
una región). Mayor carga operativa: dos modelos de IAM, replicación lógica
de Postgres entre nubes (no propaga DDL — hay que aplicar cambios de
esquema a mano en ambos lados), y sincronización de estáticos/secretos por
scripts propios en vez de features nativas.

- Postura **warm standby** en GCP, no pilot-light frío ni activo-activo.
- **Cómputo:** Managed Instance Group regional en GCP, 1 instancia mínima
  corriendo, misma imagen horneada por el CI (Packer en vez de AMI).
- **Base de datos:** Cloud SQL for PostgreSQL como suscriptor de
  replicación lógica de Aurora.
- **Estáticos:** Cloud Storage + Cloud CDN, espejo de S3.
- **Secretos:** GCP Secret Manager, espejado por un paso del CI.
- **Failover:** Cloudflare Load Balancer con health checks — pool primario
  ALB de AWS, pool de failover LB de GCP.
- RPO esperado: segundos a minutos. RTO esperado: minutos.

### Costo — GCP (DR standby)

| Recurso | Costo/mes | Nota |
|---|---:|---|
| MIG standby (1 instancia pequeña siempre corriendo) | ~$30 | Escala a capacidad base al promoverse |
| Cloud SQL Postgres (réplica de replicación lógica, siempre activa) | ~$60 | Se promueve a primario en el failover |
| Cloud Storage + Cloud CDN (espejo de estáticos) | ~$5 | |
| Transferencia de datos AWS → GCP (replicación) | ~$15 | Depende del volumen de escrituras |
| **Subtotal GCP** | **≈ $110/mes** | |

### Costo — Cloudflare (borde / failover)

| Recurso | Costo/mes | Nota |
|---|---:|---|
| Load Balancer (pools + steering AWS↔GCP) | ~$10 | |
| Health checks por origen monitoreado | ~$3 | |
| **Subtotal Cloudflare** | **≈ $13/mes** | |

## Total combinado por opción

| Opción | Costo/mes | Margen sobre $2000/mes |
|---|---:|---:|
| AWS primario + DR Full AWS (recomendado) | **≈ $539/mes** | ≈ $1461/mes |
| AWS primario + DR híbrido GCP + Cloudflare (alternativa) | **≈ $549/mes** | ≈ $1451/mes |

## Pendiente

- Pipeline de CI: bake de AMI por release, instance refresh, rollback por
  Launch Template.
- Definir política exacta de warm pool (tamaño, `Stopped` vs `Running`).
- Evaluar réplica de lectura de Aurora para el módulo de analytics.
- Confirmar si la región DR debe cubrir también la capacidad de ráfaga o
  solo la base.
- Confirmar si el failover hacia la región DR debe ser automático o
  requerir aprobación humana.
