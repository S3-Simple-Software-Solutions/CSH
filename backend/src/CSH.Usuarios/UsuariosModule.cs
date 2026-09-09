using CSH.Shared;
using CSH.Usuarios.Domain;
using CSH.Usuarios.Features.ObtenerPerfil;
using CSH.Usuarios.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CSH.Usuarios;

public static class UsuariosModule
{
    public static IServiceCollection AddUsuariosModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        var connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "Falta ConnectionStrings:Default para CSH.Usuarios.");

        services.AddDbContext<UsuariosDbContext>(opt =>
            opt.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "usuarios")));

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IUsuariosRepository, UsuariosRepository>();
        services.AddScoped<IUsuariosService, UsuariosService>();
        services.AddScoped<ObtenerPerfilHandler>();
        return services;
    }

    public static IEndpointRouteBuilder MapUsuariosEndpoints(this IEndpointRouteBuilder app)
    {
        ObtenerPerfilEndpoint.Map(app);
        return app;
    }
}
