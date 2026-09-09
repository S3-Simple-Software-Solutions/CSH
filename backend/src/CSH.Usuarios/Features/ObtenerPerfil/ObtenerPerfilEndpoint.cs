using CSH.Shared;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace CSH.Usuarios.Features.ObtenerPerfil;

public static class ObtenerPerfilEndpoint
{
    public static void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/me", Handle)
           .RequireAuthorization()
           .WithName("Me");

    private static async Task<IResult> Handle(
        ObtenerPerfilHandler handler,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var result = await handler.Handle(ct);
        return result.ToHttp(perfil => Results.Ok(new
        {
            id = perfil.Id,
            email = perfil.Email,
            nombre = perfil.Nombre,
            numeroSocio = perfil.NumeroSocio,
            isAdmin = currentUser.IsAdmin,
            roles = currentUser.Roles,
        }));
    }
}
