# Harness DEV — Backend

Extiende [`harness_DEV.md`](harness_DEV.md), que hay que leer primero.
Aplica a toda tarea que toque C#, endpoints, handlers o base de datos.

---

## 1. Estructura interna de un módulo

```
CSH.Entradas/
├── Domain/                    ← entidades, value objects, interfaces de repositorio
├── Infrastructure/            ← EF Core: EntradasDbContext, repositorios, servicios externos
│   └── Migrations/
├── Features/                  ← vertical slices (un directorio por caso de uso)
│   ├── CrearEvento/
│   │   ├── CrearEventoEndpoint.cs
│   │   ├── CrearEventoRequest.cs
│   │   └── CrearEventoHandler.cs
│   └── ComprarEntrada/
│       └── ...
└── EntradasModule.cs          ← punto de entrada del módulo
```

---

## 2. Result y Error — cómo un handler reporta un fallo

Los handlers **no lanzan excepciones** para flujos de negocio esperados
(evento agotado, butaca tomada, permisos insuficientes). Devuelven `Result<T>`.

El `Error` lleva el status HTTP, para que el endpoint pueda construir el
Problem Details sin conocer la regla de negocio que falló:

```csharp
// CSH.Shared/Results/Error.cs
public readonly record struct Error(string Title, string Detail, int Status)
{
    public static Error NotFound(string detail) =>
        new("Recurso no encontrado", detail, StatusCodes.Status404NotFound);

    public static Error Conflict(string title, string detail) =>
        new(title, detail, StatusCodes.Status409Conflict);

    public static Error Invalid(string detail) =>
        new("Solicitud inválida", detail, StatusCodes.Status400BadRequest);

    public static Error Forbidden(string detail) =>
        new("Sin permiso", detail, StatusCodes.Status403Forbidden);
}
```

```csharp
// backend/src/CSH.Shared/Results/Result.cs
public readonly struct Result<T>
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T? value, Error? error) => (_value, _error) = (value, error);

    // El atributo es lo que le permite al compilador estrechar el tipo: despues
    // de `if (!result.IsSuccess)`, sabe que result.Error no es null.
    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => _error is null;

    public T? Value => _value;
    public Error? Error => _error;

    public static Result<T> Ok(T value) => new(value, null);
    public static Result<T> Fail(Error error) => new(default, error);

    // Las conversiones implicitas dejan que el handler escriba `return entrada;`
    // y `return Error.NotFound(...);` sin ruido.
    public static implicit operator Result<T>(T value) => Ok(value);
    public static implicit operator Result<T>(Error error) => Fail(error);
}
```

**Ojo con el namespace:** estos tipos viven en `CSH.Shared` a secas, no en
`CSH.Shared.Results`, aunque los archivos estén en la carpeta `Results/`. Un
namespace terminado en `.Results` colisiona con
`Microsoft.AspNetCore.Http.Results` y el compilador resuelve `Results.Ok(...)`
contra el propio (`CS0234`).

Uso en un handler — la conversión implícita evita ruido:

```csharp
public class ComprarEntradaHandler(ICurrentUser currentUser, IEntradasRepository repo)
{
    public async Task<Result<Entrada>> Handle(ComprarEntradaRequest req, CancellationToken ct)
    {
        var evento = await repo.BuscarEvento(req.EventoId, ct);
        if (evento is null)
            return Error.NotFound($"No existe el evento {req.EventoId}.");

        if (evento.Disponibles < req.Cantidad)
            return Error.Conflict("Evento agotado",
                "No quedan entradas disponibles para este evento.");

        var entrada = new Entrada(evento.Id, currentUser.Id, req.Cantidad);
        await repo.Guardar(entrada, ct);
        return entrada;
    }
}
```

---

## 3. Contrato HTTP — respuestas

El contrato entre backend y frontend son los **status codes de HTTP** más
**RFC 9457 Problem Details** para errores. No se usa un envelope
`{ ok: true, ... }`: duplica lo que el status ya dice y obliga a leer el body
para saber si algo falló.

### Éxito — JSON plano

| Situación | Status | Body |
|---|---|---|
| GET / operación con resultado | `200 OK` | El recurso o la lista |
| POST que crea un recurso | `201 Created` | El recurso + header `Location` |
| DELETE / update sin cuerpo | `204 No Content` | vacío |

### Error — Problem Details

| Situación | Status | Fábrica de `Error` |
|---|---|---|
| Request mal formada o regla de negocio violada | `400` | `Error.Invalid(...)` |
| Validación de campos | `400` | `Results.ValidationProblem(...)` en el endpoint |
| Sin autenticar | `401` | automático (middleware) |
| Autenticado pero sin permiso | `403` | `Error.Forbidden(...)` |
| Recurso inexistente | `404` | `Error.NotFound(...)` |
| Conflicto de estado (ej. butaca ya vendida) | `409` | `Error.Conflict(...)` |

### El mapeo vive en un solo lugar

Ningún endpoint arma el Problem Details a mano. Una extensión compartida
traduce `Result<T>` a `IResult`:

```csharp
// CSH.Shared/Results/ResultExtensions.cs
public static class ResultExtensions
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess
            ? onSuccess(result.Value!)
            : Results.Problem(
                title: result.Error!.Value.Title,
                detail: result.Error!.Value.Detail,
                statusCode: result.Error!.Value.Status);
}
```

Habilitar Problem Details global en `CSH.Host/Program.cs`:

```csharp
builder.Services.AddProblemDetails();
app.UseExceptionHandler();   // excepciones no manejadas → 500 en Problem Details
```

**Nunca** filtrar stack traces ni mensajes de excepción al cliente. `Detail`
tiene que ser texto que se le pueda mostrar a un aficionado.

---

## 4. Endpoint (Minimal API)

El endpoint no contiene lógica: declara la ruta, la autorización, y mapea el
`Result` a HTTP.

```csharp
// Features/CrearEvento/CrearEventoEndpoint.cs
public static class CrearEventoEndpoint
{
    public static void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/eventos", Handle)
           .RequireAuthorization("Admin")
           .WithName("CrearEvento");

    private static async Task<IResult> Handle(
        CrearEventoRequest request,
        CrearEventoHandler handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(request, ct);
        return result.ToHttp(evento =>
            Results.Created($"/api/eventos/{evento.Id}", evento));
    }
}
```

### Validación de campos

Data Annotations en el `Request` para lo simple; **FluentValidation** para
reglas condicionales o que cruzan campos. La validación de forma va antes del
handler; las reglas de negocio van dentro del handler y devuelven `Error`.

---

## 5. EF Core

- Migraciones en `Infrastructure/Migrations/` dentro del módulo.
- No encadenar `Include()` — preferir queries proyectadas con `Select()`.
- `AsNoTracking()` en toda query de solo lectura.
- Nada de lógica de negocio en el repositorio: recibe y devuelve entidades.

### Un esquema y un historial de migraciones por módulo

Todos los módulos comparten la misma base PostgreSQL, cada uno en su esquema.
Eso exige **dos** configuraciones, no una:

```csharp
// 1. Las tablas del módulo van a su esquema
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.HasDefaultSchema("entradas");
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(EntradasDbContext).Assembly);
}
```

```csharp
// 2. El historial de migraciones TAMBIÉN va a su esquema
services.AddDbContext<EntradasDbContext>(opt =>
    opt.UseNpgsql(config.GetConnectionString("Default"), npgsql =>
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "entradas")));
```

**La segunda es la que se olvida, y rompe todo.** Sin ella, cada `DbContext`
escribe en `public.__EFMigrationsHistory`: `dotnet ef` del módulo B ve las
migraciones del módulo A, cree que ya se aplicaron, y deja la base a medias sin
avisar.

Se descartó una base por módulo: multiplica el costo de operación y hace
imposible cualquier consulta que cruce módulos, que analytics va a necesitar.

### Concurrencia

En operaciones donde dos usuarios pueden competir por el mismo recurso
(butacas, plazas de parqueo, cupos), la exclusión la garantiza **la base**, no
el código C#. Usar un token de concurrencia o un `UPDATE … WHERE` condicional:

```csharp
entity.Property(e => e.Version).IsRowVersion();
```

Sin eso, dos compras simultáneas pasan las dos validaciones y venden la misma
butaca dos veces. Ver el test obligatorio en
[`harness_DEV_testing.md`](harness_DEV_testing.md).

### Aplicar las migraciones — en el arranque, con un lock

Definir una migración es solo la mitad; la otra es **cuándo se aplica**. En este
proyecto se aplican **en el arranque del Host**, serializadas por un advisory
lock de Postgres. Cero infraestructura nueva.

**Por qué en el arranque y no un job aparte.** La base vive en subredes
privadas: un job desde el CI necesitaría un bastión o SSM para alcanzarla. Las
instancias, en cambio, ya arrancan dentro de la VPC y con el secreto de la base.
El día que la escala lo pida se mueve a un job dedicado; hoy no paga.

**Por qué el lock.** El deploy es un `instance_refresh` Rolling al 50% de sanas
(`infra/modules/computo`): la imagen vieja y la nueva conviven, y en producción
varias instancias arrancan a la vez. Sin lock, dos aplican las migraciones sobre
el mismo esquema al mismo tiempo. `pg_advisory_lock` las serializa: la primera
migra, las demás esperan y encuentran la base ya al día.

```csharp
// CSH.Host/Startup/Migraciones.cs
public static class Migraciones
{
    private const long Llave = 727; // constante del proyecto, igual en toda instancia

    public static async Task AplicarMigraciones(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();

        // Una conexión aparte sostiene el lock mientras corren todas las
        // migraciones; se toma del mismo string que usan los módulos.
        await using var candado = new NpgsqlConnection(
            app.Configuration.GetConnectionString("Default"));
        await candado.OpenAsync();
        await Ejecutar(candado, "SELECT pg_advisory_lock(@k)");

        try
        {
            // Un contexto por módulo. Al nacer un módulo, se agrega su contexto.
            await scope.ServiceProvider
                .GetRequiredService<UsuariosDbContext>().Database.MigrateAsync();
        }
        finally
        {
            await Ejecutar(candado, "SELECT pg_advisory_unlock(@k)");
        }
    }

    private static async Task Ejecutar(NpgsqlConnection c, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, c);
        cmd.Parameters.AddWithValue("k", Llave);
        await cmd.ExecuteNonQueryAsync();
    }
}
```

```csharp
// CSH.Host/Program.cs — después de builder.Build(), antes de servir tráfico
await app.AplicarMigraciones();
```

**La regla que esto impone: expand/contract.** Como la versión vieja sigue viva
durante el refresh, cada migración tiene que ser **compatible hacia atrás**. Un
`drop`/`rename` destructivo en el mismo release que estrena la columna rompe la
instancia vieja a media rotación. Se parte en dos releases: primero *expandir*
(agregar lo nuevo sin tocar lo viejo), y solo cuando ninguna instancia usa lo
viejo, *contraer* (quitarlo) en el release siguiente.

**Nota de permisos.** Hoy la app conecta con el usuario maestro de RDS, que
puede crear esquemas — por eso `MigrateAsync()` levanta el esquema del módulo
solo. El día que exista un rol de aplicación con menos privilegios, el DDL de
las migraciones va a necesitar un rol que sí pueda crear esquemas. Queda como
pregunta abierta, junto con las de §6.

---

## 6. Autenticación

### Las cuentas viven en Cognito

`CSH.Usuarios` **no guarda credenciales**. Las cuentas —`administrativos`,
`socios`, `invitados`— viven en un user pool de Cognito. El módulo guarda el
perfil del aficionado y lo relaciona con el `sub` de Cognito, que es el
identificador estable de la persona (el mismo en web y móvil).

Cognito emite los tokens; el Host los valida contra el issuer del pool. Los
roles llegan en el claim `cognito:groups`. La precedencia del grupo (1 / 10 /
100) decide cuál gana en Cognito cuando alguien está en más de uno; en la app,
`IsInRole` mira el claim, no esa precedencia.

**Quién crea el perfil.** El primer `GET /api/me` autenticado inserta la fila
si no existe (`ObtenerPerfilHandler`). No hay trigger del pool ni Lambda. El
insert es idempotente (unique en `Id` = `sub`): dos requests a la vez dejan
una sola fila.

**Dos app clients, no uno.** El BFF usa un client **confidencial** (`generate_secret`).
El móvil usa uno **público** (PKCE, sin secret). Terraform
`infra/modules/identidad` todavía define un solo client público: está
desfasado. Hasta que se alinee, el pool de `dev` en AWS (`csh-dev`) es la
fuente de verdad operativa.

La configuración entra por `Cognito__*` / user-secrets / `.env.cognito.dev`.
Nunca el secret en git. Si falta un campo, el Host no arranca.

### Un esquema por tipo de cliente

Hay dos clientes con entornos de seguridad distintos, así que autentican
distinto. Los dos terminan en un `ClaimsPrincipal`, de modo que **los handlers
no se enteran de la diferencia**.

| Cliente | Esquema | Dónde vive la credencial |
|---|---|---|
| SPA (`frontend`) | Cookie `httpOnly`, vía BFF | Solo en el navegador como cookie que el JS no puede leer |
| App móvil (M9) | Bearer | `SecureStore` del dispositivo — Keychain / Keystore |

**Por qué el móvil lleva el token directo.** Cliente público con PKCE es el
patrón estándar para apps nativas (RFC 8252). El almacenamiento seguro del
sistema operativo no tiene equivalente a un XSS: no hay forma de que otro
código de la app lea el token.

**Por qué la web no.** PKCE protege el **intercambio del código**, no el
**token ya guardado**. Son amenazas distintas:

| Amenaza | ¿PKCE la cubre? |
|---|---|
| Interceptar el código en el redirect | Sí, es exactamente para eso |
| XSS leyendo el token del `localStorage` | No |

Y en este proyecto los **administradores entran por el navegador**. Un refresh
token de 30 días en el `localStorage` de un admin es la credencial más valiosa
del sistema en el entorno más hostil: un XSS da un mes de acceso
administrativo. Guardarlo solo en memoria se pierde en cada recarga, y la
presión de UX termina devolviéndolo al `localStorage`.

Por eso la web usa **BFF**: el backend hace el intercambio del código con el
client confidencial y le entrega al navegador una cookie `httpOnly`. La SPA
nunca ve un token.

El cableado vive en `CSH.Host/Auth/`, no suelto en `Program.cs`. Hace falta un
**policy scheme** que elija cookie o Bearer según el header `Authorization`.
Sin eso, un `/api/*` sin sesión redirige al Hosted UI en vez de devolver 401.

```csharp
// CSH.Host/Auth/AuthServiceCollectionExtensions.cs — idea, no copiar a ciegas
builder.Services.AddAuthentication(o =>
{
    o.DefaultScheme = "CookieOrBearer";
    o.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddPolicyScheme("CookieOrBearer", "...", o =>
{
    o.ForwardDefaultSelector = ctx =>
        ctx.Request.Headers.Authorization.ToString()
            .StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? JwtBearerDefaults.AuthenticationScheme
            : CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(/* httpOnly, 401 en /api/* */)
.AddOpenIdConnect(/* client confidencial, code + PKCE, SaveTokens = false */)
.AddJwtBearer(/* issuer del pool */);
```

Rutas de sesión (web):

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/auth/login` | Challenge OIDC → Hosted UI |
| `POST` | `/api/auth/logout` | Cierra cookie + logout de Cognito |
| `GET` | `/api/me` | Perfil; lo crea si no existe. **401** sin sesión, nunca redirect |

`/api/logout` **no existe**. El frontend usa `/api/auth/logout`.

### Access token vs ID token

La cookie web copia claims del **ID token** (`email`, `name`,
`cognito:groups`). El móvil, bien hecho, manda el **access token**.

El access token de Cognito **casi nunca trae `email` ni `name`**. Trae `sub`,
`client_id`, `token_use=access`. `CurrentUser.Email` hoy exige `email`: un
Bearer de access token puede autenticar y **explotar en `/api/me`**. Eso es
un hueco conocido, no una feature.

Hasta que se arregle (email en el access token vía pre-token, o perfil que
solo exija `sub` y complete el resto después):

- No asumir que el JWT del móvil tiene los mismos claims que la cookie.
- No mandar el ID token “porque funciona en Postman”. El contrato móvil es
  access token + refresh.
- `ValidateAudience` hoy está en `false` porque Cognito pone el client en
  `client_id`, no siempre en `aud`. Hay que validar `client_id` contra el
  client móvil; dejarlo abierto es temporal.

`cognito:groups` a veces llega como **un** claim con JSON array, no como
varios claims. `IsInRole("administrativos")` puede fallar hasta que se
normalice al armar el principal.

`ALLOW_ADMIN_USER_PASSWORD_AUTH` en el client móvil es **solo para pruebas
locales**. No va a un ambiente real.

### La sesión web empieza autocontenida

La cookie lleva los claims copiados del ID token y los tokens de Cognito se
descartan. Cero almacenamiento de sesión, y ya se gana el `httpOnly`.

**Se pasa a sesión con referencia del lado servidor solo cuando la operación lo
pida** — cuando revocar a un admin tenga que ser inmediato en vez de esperar a
que expire la cookie. No antes: es estado que hay que mantener.

### La entrada tiene que funcionar sin sesión

Consecuencia directa de lo anterior, y la que rompe todo si se descubre tarde.

El día del partido el aficionado llega al molinete con el access token vencido
—dura 60 minutos— y sin señal para refrescarlo, porque hay veinte mil personas
saturando el wifi del estadio.

**Si mostrar la entrada requiere una sesión válida o una llamada a la API, no
funciona justo el día que importa.** Entonces:

- El QR es un **artefacto firmado** que la app descargó cuando tenía señal, no
  una consulta a `/api/entradas/{id}`.
- El escáner del molinete lo valida contra una **clave pública local**, sin red.
- La revocación viaja como una lista que el escáner sincroniza cuando puede, no
  como una consulta en línea.

Esto aplica igual a la app móvil y a una entrada mostrada desde el navegador.

### Cómo un handler sabe quién es el usuario

Los handlers **nunca** tocan `HttpContext`. Inyectan `ICurrentUser`, definido en
`CSH.Shared`:

```csharp
// CSH.Shared/Auth/ICurrentUser.cs — el contrato real
public interface ICurrentUser
{
    Guid Id { get; }              // sub de Cognito
    string Email { get; }
    string Nombre { get; }
    string? NumeroSocio { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
}
```

`Id` es el **`sub` de Cognito** (`Guid.Parse`), no un id propio de la
aplicación: es lo que `CSH.Usuarios` usa para relacionar el perfil.

La implementación (`CSH.Host/Auth/CurrentUser.cs`) es la **única** clase que
conoce `HttpContext`. Si mañana se reemplaza Cognito, se cambia ahí.
`RoleClaimType` es `cognito:groups`.

```csharp
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
```

### Protección de endpoints

La autorización se declara en el endpoint, no se chequea dentro del handler:

```csharp
app.MapPost("/api/entradas/comprar", Handle)
   .RequireAuthorization();               // cualquier usuario autenticado

app.MapPost("/api/admin/eventos", Handle)
   .RequireAuthorization("administrativos");  // grupo de Cognito
```

Un endpoint que acepta los dos clientes no declara esquema; uno exclusivo de
uno declara el suyo:

```csharp
   .RequireAuthorization(new AuthorizationPolicyBuilder(
        CookieAuthenticationDefaults.AuthenticationScheme)  // solo web
        .RequireAuthenticatedUser().Build());
```

### Despliegue multi-instancia

Cuando la app corra en más de una instancia (ASG de AWS), las **Data Protection
keys** tienen que compartirse — si no, un usuario de la web pierde la sesión al
rebotar de instancia. Se persisten en la base o en S3:

```csharp
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<UsuariosDbContext>();
```

Al móvil no le afecta: valida el JWT contra el issuer, sin estado local.

### Preguntas abiertas

Cerradas al escribir `CSH.Usuarios`:

1. **Quién crea el perfil.** El primer `GET /api/me` autenticado. No hay
   trigger de Cognito.
2. **El segundo client.** Existe: BFF confidencial + móvil público. Falta
   reflejarlo en Terraform.

Siguen abiertas:

3. **Qué es un `invitado`.** Es un grupo de Cognito (aficionado registrado sin
   membresía). ¿Se puede comprar **sin cuenta** (guest checkout)? Eso toca
   Entradas y no está en el [glosario](glosario.md).
4. **El portal cautivo (M10).** El aficionado se conecta al wifi del estadio
   pasando por Aruba. ¿Es la misma identidad? ¿Participa la app?

---

## 7. Comunicación entre módulos

Los módulos no se referencian entre sí directamente. Hay dos patrones según el caso.

### Caso 1 — Query: un módulo necesita datos de otro

Interfaz pública en `CSH.Shared`. El módulo dueño la implementa; el consumidor
la inyecta.

```csharp
// CSH.Shared/Contracts/IUsuariosService.cs
public interface IUsuariosService
{
    Task<UsuarioDto?> BuscarPorId(Guid id, CancellationToken ct);
}

// CSH.Usuarios implementa la interfaz
// CSH.Entradas inyecta IUsuariosService — nunca referencia CSH.Usuarios directamente
```

### Caso 2 — Evento: algo ocurrió y otros módulos reaccionan

Para reacciones **opcionales**: algo pasó y a otros módulos les interesa, pero la
operación original no depende de que reaccionen. El evento se define en
`CSH.Shared/Events/`; cada módulo interesado registra su propio handler.

> **MediatR pasó a licencia comercial.** Antes de adoptarlo hay que decidir:
> fijar la última versión Apache-2.0, pagar la licencia, o usar un dispatcher
> propio —para un monolito modular son ~30 líneas—. Lo que sigue vale igual con
> las tres opciones: el patrón no cambia, solo cambia quién resuelve el `Publish`.

```csharp
// CSH.Shared/Events/EntradaCompradaEvent.cs
public record EntradaCompradaEvent(Guid EntradaId, Guid UsuarioId, string Email)
    : INotification;
```

```csharp
// CSH.Entradas publica el evento — DESPUÉS de confirmar la compra (ver abajo)
await mediator.Publish(new EntradaCompradaEvent(entrada.Id, usuario.Id, usuario.Email), ct);
```

```csharp
// CSH.Comunicaciones escucha y manda el correo de confirmación, en su propio
// handler. Si el correo falla, la compra sigue siendo válida: por eso es un
// evento y no una llamada por interfaz.
public class EnviarConfirmacionHandler(IEmailService email)
    : INotificationHandler<EntradaCompradaEvent>
{
    public async Task Handle(EntradaCompradaEvent e, CancellationToken ct) =>
        await email.EnviarConfirmacionCompra(e.Email, e.EntradaId, ct);
}
```

**Ojo con qué se manda por evento.** Mandar el correo es opcional: si se pierde,
la compra no se invalida. En cambio, *registrar la compra en el perfil del
usuario* NO es opcional —perder el historial de un aficionado es un bug—, así
que eso va por **Caso 1** (interfaz síncrona, en la misma transacción), no por
un evento. La prueba es simple: **si perder la reacción es un bug, no es un
evento.**

### Cuándo se publica, y qué pasa si el handler falla

Un `Publish` en proceso es **at-most-once**: corre en la misma llamada, y si la
instancia se cae a mitad, el evento se pierde. Dos reglas lo hacen predecible:

1. **Publicar DESPUÉS del commit, nunca antes.** Si se publica antes de
   `SaveChanges` y el commit falla, los suscriptores reaccionaron a una compra
   que no ocurrió. El evento sale cuando el cambio ya es un hecho.
2. **El handler es idempotente.** Puede llegar a correr dos veces (reintento,
   redeploy); procesar el mismo evento dos veces no debe duplicar efectos.

Además, cada módulo tiene su **propio `DbContext` y esquema**, así que el
`Publish` **no es atómico entre módulos**: si el handler falla, el cambio del
módulo origen ya se comprometió y no hay rollback cruzado. Eso es aceptable
*solo* porque el evento es opcional (esa es la regla de arriba).

**Cuando perder el evento sí duele → outbox.** Como todos los módulos comparten
la misma base, la fila del outbox se guarda en el **mismo `SaveChanges`** que el
cambio de negocio: o se guardan los dos, o ninguno. Un proceso aparte lee el
outbox y publica. No se arranca con outbox: se agrega el día que exista un evento
que no se pueda perder. Antes es infraestructura sin dueño.

### Reglas

- Los eventos van en `CSH.Shared/Events/` — son el contrato público entre módulos.
- Los handlers de eventos van dentro del módulo que reacciona, nunca en Shared.
- Comunicación obligatoria y síncrona → interfaz en Shared (Caso 1).
- Comunicación opcional o desacoplada → evento (Caso 2).
- **Si perder la reacción es un bug, es Caso 1, no un evento.**
- Un evento se publica **después** del commit, y su handler es **idempotente**.
- Perder el evento no puede ser un bug… salvo que se respalde con un **outbox**.
- `CSH.Shared` no contiene lógica, solo contratos (`interface`, `record`, `dto`).

---

## 8. Cómo agregar un módulo nuevo

Seguir estos pasos en orden. Un módulo incompleto no se mergea.

### 1. Crear el proyecto y agregarlo a la solución

```bash
dotnet new classlib -n CSH.NombreModulo -o backend/src/CSH.NombreModulo
dotnet sln add backend/src/CSH.NombreModulo/CSH.NombreModulo.csproj
dotnet add backend/src/CSH.NombreModulo reference backend/src/CSH.Shared/CSH.Shared.csproj
```

### 2. Crear la estructura interna

La de §1, con al menos un caso de uso en `Features/`.

### 3. Crear el DbContext con esquema propio

```csharp
// Infrastructure/NombreModuloDbContext.cs
public class NombreModuloDbContext(DbContextOptions<NombreModuloDbContext> options)
    : DbContext(options)
{
    public DbSet<NombreEntidad> Entidades => Set<NombreEntidad>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("nombre_modulo"); // esquema propio en PostgreSQL
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NombreModuloDbContext).Assembly);
    }
}
```

El historial de migraciones va al mismo esquema — se configura en el registro
del módulo (paso 5), no acá. Ver §5.

### 4. Crear la primera migración

```bash
dotnet ef migrations add Init \
  --project backend/src/CSH.NombreModulo \
  --startup-project backend/src/CSH.Host \
  --context NombreModuloDbContext \
  --output-dir Infrastructure/Migrations
```

### 5. Registrar el módulo

```csharp
// NombreModuloModule.cs
public static class NombreModuloModule
{
    public static IServiceCollection AddNombreModulo(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<NombreModuloDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Default"), npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "nombre_modulo")));
        services.AddScoped<INombreModuloRepository, NombreModuloRepository>();
        services.AddScoped<PrimerCasoHandler>();
        return services;
    }

    public static IEndpointRouteBuilder MapNombreModuloEndpoints(
        this IEndpointRouteBuilder app)
    {
        PrimerCasoEndpoint.Map(app);
        return app;
    }
}
```

```csharp
// CSH.Host/Program.cs — agregar estas dos líneas
builder.Services.AddNombreModulo(builder.Configuration);
app.MapNombreModuloEndpoints();
```

### 6. Crear el proyecto de tests

```bash
dotnet new xunit -n CSH.NombreModulo.Tests -o backend/tests/CSH.NombreModulo.Tests
dotnet sln add backend/tests/CSH.NombreModulo.Tests/CSH.NombreModulo.Tests.csproj
dotnet add backend/tests/CSH.NombreModulo.Tests reference backend/src/CSH.NombreModulo/CSH.NombreModulo.csproj
```

### 7. Verificar antes de commitear

```bash
dotnet build backend/CSH.slnx
dotnet test backend/CSH.slnx
```
