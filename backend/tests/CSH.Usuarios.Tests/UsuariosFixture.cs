using CSH.Usuarios.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace CSH.Usuarios.Tests;

public sealed class UsuariosFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _db.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        await using var ctx = NuevoContexto();
        await ctx.Database.MigrateAsync();
    }

    public UsuariosDbContext NuevoContexto() =>
        new(new DbContextOptionsBuilder<UsuariosDbContext>()
            .UseNpgsql(ConnectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "usuarios"))
            .Options);

    public async Task DisposeAsync() => await _db.DisposeAsync();
}
