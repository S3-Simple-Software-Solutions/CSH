using CSH.Usuarios.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CSH.Host.Startup;

/// <summary>
/// Aplica las migraciones de cada módulo al arrancar, serializadas con un
/// advisory lock de Postgres (docs/harness_DEV_backend.md §5).
/// </summary>
public static class Migraciones
{
    private const long Llave = 727;

    public static async Task AplicarMigraciones(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();

        var connectionString = app.Configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Falta ConnectionStrings:Default para aplicar migraciones.");

        await using var candado = new NpgsqlConnection(connectionString);
        await candado.OpenAsync();
        await Ejecutar(candado, "SELECT pg_advisory_lock(@k)");

        try
        {
            await scope.ServiceProvider
                .GetRequiredService<UsuariosDbContext>()
                .Database
                .MigrateAsync();
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
