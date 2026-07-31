// Entry point de la solucion. Se mantiene delgado a proposito: compone los
// modulos y arranca la app. Toda la logica vive en los modulos.
//
// Cuando exista el primer modulo, aca van sus dos lineas:
//   builder.Services.AddSitioModule(builder.Configuration);
//   app.MapSitioEndpoints();

var builder = WebApplication.CreateBuilder(args);

// Los errores salen como RFC 9457 Problem Details (docs/harness_DEV_backend.md §3).
builder.Services.AddProblemDetails();

var app = builder.Build();

// Traduce excepciones no manejadas a un 500 en Problem Details, sin filtrar
// stack traces al cliente.
app.UseExceptionHandler();

// La SPA compilada se sirve desde wwwroot; en desarrollo se trabaja contra
// Vite (5173), que proxea /api hacia aca.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/healthz", () => Results.Ok(new { estado = "ok" }))
   .WithName("Healthz");

// Cualquier ruta que no sea /api ni un archivo estatico la resuelve el router
// del cliente: sin esto, recargar en /noticias/algo devuelve 404.
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>
/// Visible para los tests de integracion (WebApplicationFactory). Un archivo de
/// top-level statements genera una clase Program interna por defecto.
/// </summary>
public partial class Program;
