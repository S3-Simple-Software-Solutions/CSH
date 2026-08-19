using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CSH.Usuarios.Infrastructure;

/// <summary>
/// Permite <c>dotnet ef</c> sin arrancar el Host (que exige Cognito).
/// </summary>
public sealed class UsuariosDbContextFactory : IDesignTimeDbContextFactory<UsuariosDbContext>
{
    public UsuariosDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? "Host=localhost;Database=csh_dev;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<UsuariosDbContext>()
            .UseNpgsql(cs, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "usuarios"))
            .Options;

        return new UsuariosDbContext(options);
    }
}
