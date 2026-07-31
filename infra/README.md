# Infraestructura

Terraform de los tres ambientes que exige el SOW: **desarrollo, pruebas y
producción**, cada uno con su propia base de datos. Corresponde a la épica
[BA.EP2](https://github.com/S3-Simple-Software-Solutions/CSH/issues/56) —
funciones B3 y B4. El diseño y los costos están en
[`../docs/infra.md`](../docs/infra.md).

## Estructura

```
infra/
├── ambientes/          ← un state por ambiente
│   ├── comun/          ← registro de imagenes, compartido por los tres
│   ├── dev/
│   ├── pruebas/
│   └── produccion/
└── modules/
    ├── ambiente/       ← compone los de abajo
    ├── red/            ← VPC, subredes, security groups en cadena
    ├── datos/          ← Aurora PostgreSQL Serverless v2
    ├── identidad/      ← Cognito: administrativos, socios, invitados
    ├── computo/        ← ALB, Auto Scaling Group, warm pool, WAF
    └── registro/       ← ECR
```

Un ambiente es el mismo código con distintos números. Lo que los diferencia
vive en `ambientes/<nombre>/main.tf`:

| | dev | pruebas | producción |
|---|---|---|---|
| CIDR | 10.10.0.0/16 | 10.20.0.0/16 | 10.30.0.0/16 |
| Instancias (min/max) | 1 / 2 | 1 / 3 | 2 / 10 |
| Tipo | t3.small | t3.small | t3.medium |
| Aurora (ACU) | 0.5 – 1 | 0.5 – 2 | 0.5 – 8 |
| Respaldos | 1 día | 7 días | 14 días |
| Warm pool | no | no | sí |
| WAF | no | no | sí |
| Protección de borrado | no | no | sí |

## Antes del primer apply

Terraform guarda el state en S3 y se bloquea con DynamoDB. Las dos cosas tienen
que existir **antes** del primer `init`, y no las crea este código —
si las creara, quedaría el problema del huevo y la gallina:

```bash
aws s3api create-bucket --bucket antonyproyects --region us-east-1
aws s3api put-bucket-versioning --bucket antonyproyects \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name csh-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

El bucket `antonyproyects` viene de la convención del repo VPS_CONTROLLER.
**Cuando la cuenta pase a nombre del club** (acta §10, cláusula 8 del contrato)
hay que mover el state a un bucket de esa cuenta.

## Orden de aplicación

`comun` va primero: los ambientes buscan el repositorio de imágenes por nombre y
fallan si no existe.

```bash
cd ambientes/comun && terraform init && terraform apply

cd ../dev        && terraform init && terraform apply -var 'imagen_tag=dev'
cd ../pruebas    && terraform init && terraform apply -var 'imagen_tag=pruebas'
cd ../produccion && terraform init && terraform apply -var 'imagen_tag=0.7'
```

Antes del primer apply de un ambiente hay que empujar una imagen con ese tag al
ECR; si no, las instancias arrancan y no encuentran qué correr.

## Cómo se despliega una versión

No se hornea AMI por release. La instancia arranca de la AMI estándar de Amazon
Linux 2023, instala podman y corre la imagen de ECR — la misma que construye
[`../cicd/Containerfile`](../cicd/Containerfile) y que se usa en local.

Un deploy es cambiar `imagen_tag`: eso reescribe el launch template y el
**instance refresh** del Auto Scaling Group reemplaza las instancias sin tumbar
el servicio. Reemplaza al symlink `current` de la infra vieja.

Revertir es aplicar el tag anterior. No hay rebuild: la imagen ya existe en ECR
y se conservan las últimas 20.

## Cuentas de usuario — Cognito

Las cuentas viven en un **user pool por ambiente**, no en una tabla de la
aplicación. Tres grupos, con precedencia — el número más bajo gana cuando
alguien pertenece a más de uno:

| Grupo | Precedencia | Quién |
|---|---:|---|
| `administrativos` | 1 | Personal del club: taquilla, parqueo, comercial, comunicación |
| `socios` | 10 | Membresía vigente y sus beneficios |
| `invitados` | 100 | Aficionado registrado sin membresía |

Consecuencias para el backend, que **contradicen lo que dice hoy
`docs/harness_DEV_backend.md` §6**:

- `CSH.Usuarios` deja de guardar credenciales. Guarda el perfil y lo relaciona
  con el `sub` de Cognito, que es el identificador estable de la persona.
- El token lo emite Cognito y la app lo **valida** contra el issuer del pool
  (`Cognito__Authority`, que llega por variable de entorno). El harness eligió
  cookie de ASP.NET Core y descartó JWT; con un proveedor externo eso cambia.
- La revocación sigue resuelta: token de acceso de 60 minutos, refresco de 30
  días y `enable_token_revocation`, así que se puede cortar el acceso de una
  cuenta comprometida sin esperar a que expire.
- El cliente no tiene secreto: lo usan la SPA y la app móvil, donde un secreto
  embebido no es un secreto. La protección es PKCE.
- El atributo `custom:numero_socio` amarra la cuenta con el padrón de
  membresías (M11) sin duplicar el padrón dentro de Cognito.

El flujo *hosted* de Cognito queda apagado mientras no haya dominio: sin URLs de
retorno, `allowed_oauth_flows` va vacío. Al definirse el dominio se llenan
`urls_retorno` y `urls_salida` y se prende solo.

## Endurecimiento de las instancias

Lo que hace el `user_data` además de levantar la app:

- `dnf update --security` al arrancar —la AMI puede tener semanas— y
  `dnf-automatic` para los parches siguientes: una instancia del grupo puede
  vivir semanas y nadie entra a actualizarla a mano.
- **SSH apagado.** El acceso es por SSM Session Manager: sin llaves que rotar ni
  repartir. Con `sshd` corriendo, un error futuro en el security group volvería
  a exponerlo.
- **IMDS a un salto** (`http_put_response_hop_limit = 1`). Alcanza para el
  `user_data`, que corre en el host, y deja al contenedor sin acceso al servicio
  de metadatos: sin esto, cualquier cosa que se ejecute dentro del contenedor
  puede pedir las credenciales del rol de la instancia. La app no las necesita.
- **Volumen raíz cifrado**: ahí queda `/etc/csh.env` con la clave de la base.
- **Contenedor con lo mínimo**: `--cap-drop=ALL`, `--security-opt
  no-new-privileges`, `--read-only` con `/tmp` en tmpfs, y límites de memoria y
  de procesos para que un runaway no se lleve la instancia.
- `sysctl` endurecido sin tocar `ip_forward`, que podman necesita para publicar
  puertos.

> Con `--read-only`, cuando entren las Data Protection keys de ASP.NET hay que
> persistirlas en la base (como ya indica el harness), no en el disco.

## Lo que este código todavía no hace

- **DR en segunda región.** Aurora Global, S3 CRR y Route53 con failover
  (`docs/infra.md` §DR). No estaba en el SOW original: necesita re-cotización.
- **DNS y TLS.** El dominio está sin definir (`herediano-dev.milocalaws.work`
  es lo tentativo). Mientras `certificado_arn` sea `null`, el ALB sirve por el
  80; apenas exista certificado, el 80 redirige al 443 sin tocar nada más.
- **Conectar el CI.** Los workflows todavía despliegan al servidor local por
  SSH. Falta que empujen la imagen a ECR y disparen el instance refresh.
- **Migrar `ALL_SECRETS`** a Secrets Manager.
- **Observabilidad.** CloudWatch alarms y logs de la app.

## Verificado

`terraform fmt` y `terraform validate` pasan en los cuatro directorios con
Terraform 1.9.8 y el provider AWS 5.x. **No se corrió `plan` ni `apply`**: no
hay cuenta de AWS ni credenciales todavía.
