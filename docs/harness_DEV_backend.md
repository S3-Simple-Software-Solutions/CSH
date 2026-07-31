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
// CSH.Shared/Results/Result.cs
public readonly struct Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;

    private Result(T? value, Error? error) => (Value, Error) = (value, error);

    public static Result<T> Ok(T value) => new(value, null);
    public static Result<T> Fail(Error error) => new(default, error);

    public static implicit operator Result<T>(T value) => Ok(value);
    public static implicit operator Result<T>(Error error) => Fail(error);
}
```

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

---

## 6. Autenticación

### Decisión: cookie authentication de ASP.NET Core, no JWT

CSH es un monolito servido desde un mismo origen, sin app móvil ni API pública
para terceros. El JWT resuelve auth distribuida o cross-origin — ninguno de los
dos casos aplica acá. Y en una ticketera hace falta poder **cortar acceso ya**
(cuenta comprometida, fraude en una apertura de venta, admin que sale del club);
un JWT no se revoca sin mantener una blocklist, que reintroduce el estado que el
JWT supuestamente evitaba.

La cookie de ASP.NET Core también es self-contained — lleva el `ClaimsPrincipal`
cifrado, sin lookup a la DB por request — pero además tiene punto de revocación
vía `SecurityStamp`.

**Qué cambiaría esta decisión:** una app móvil nativa o exponer API a terceros.
Ninguna está en el roadmap. Si llega, se cambia solo la implementación de
`ICurrentUser` en `CSH.Host` — ningún módulo se entera.

### Cómo un handler sabe quién es el usuario

Los handlers **nunca** tocan `HttpContext`. Inyectan `ICurrentUser`, definido en
`CSH.Shared`:

```csharp
// CSH.Shared/Auth/ICurrentUser.cs
public interface ICurrentUser
{
    Guid Id { get; }
    string Email { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
}
```

```csharp
// CSH.Host/Auth/CurrentUser.cs — única clase que conoce HttpContext
public class CurrentUser(IHttpContextAccessor http) : ICurrentUser
{
    private ClaimsPrincipal User => http.HttpContext!.User;

    public Guid Id => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    public string Email => User.FindFirst(ClaimTypes.Email)!.Value;
    public bool IsAdmin => User.IsInRole("Admin");
    public bool IsAuthenticated => User.Identity?.IsAuthenticated ?? false;
}
```

```csharp
// CSH.Host/Program.cs
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
```

### Protección de endpoints

La autorización se declara en el endpoint, no se chequea dentro del handler:

```csharp
app.MapPost("/api/entradas/comprar", Handle)
   .RequireAuthorization();          // cualquier usuario autenticado

app.MapPost("/api/admin/eventos", Handle)
   .RequireAuthorization("Admin");   // solo admins
```

### Despliegue multi-instancia

Cuando la app corra en más de una instancia (ASG de AWS), las **Data Protection
keys** tienen que compartirse — si no, un usuario pierde la sesión al rebotar de
instancia. Se persisten en la base o en S3:

```csharp
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<UsuariosDbContext>();
```

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

**MediatR**. El evento se define en `CSH.Shared`; cada módulo interesado
registra su propio handler.

```csharp
// CSH.Shared/Events/EntradaCompradaEvent.cs
public record EntradaCompradaEvent(Guid EntradaId, Guid UsuarioId, string Email)
    : INotification;
```

```csharp
// CSH.Entradas publica el evento desde el handler
await mediator.Publish(new EntradaCompradaEvent(entrada.Id, usuario.Id, usuario.Email), ct);
```

```csharp
// CSH.Usuarios escucha y reacciona — en su propio handler
public class RegistrarCompraHandler(IUsuariosRepository repo)
    : INotificationHandler<EntradaCompradaEvent>
{
    public async Task Handle(EntradaCompradaEvent e, CancellationToken ct) =>
        await repo.RegistrarCompra(e.UsuarioId, e.EntradaId, ct);
}
```

### Reglas

- Los eventos van en `CSH.Shared/Events/` — son el contrato público entre módulos.
- Los handlers de eventos van dentro del módulo que reacciona, nunca en Shared.
- Comunicación obligatoria y síncrona → interfaz en Shared (Caso 1).
- Comunicación opcional o desacoplada → evento MediatR (Caso 2).
- `CSH.Shared` no contiene lógica, solo contratos (`interface`, `record`, `dto`).

---

## 8. Cómo agregar un módulo nuevo

Seguir estos pasos en orden. Un módulo incompleto no se mergea.

### 1. Crear el proyecto y agregarlo a la solución

```bash
dotnet new classlib -n CSH.NombreModulo -o src/CSH.NombreModulo
dotnet sln add src/CSH.NombreModulo/CSH.NombreModulo.csproj
dotnet add src/CSH.NombreModulo reference src/CSH.Shared/CSH.Shared.csproj
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

### 4. Crear la primera migración

```bash
dotnet ef migrations add Init \
  --project src/CSH.NombreModulo \
  --startup-project src/CSH.Host \
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
            opt.UseNpgsql(config.GetConnectionString("Default")));
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
dotnet new xunit -n CSH.NombreModulo.Tests -o tests/CSH.NombreModulo.Tests
dotnet sln add tests/CSH.NombreModulo.Tests/CSH.NombreModulo.Tests.csproj
dotnet add tests/CSH.NombreModulo.Tests reference src/CSH.NombreModulo/CSH.NombreModulo.csproj
```

### 7. Verificar antes de commitear

```bash
dotnet build CSH.sln
dotnet test CSH.sln
```
