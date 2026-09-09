using CSH.Shared;
using CSH.Usuarios.Domain;
using CSH.Usuarios.Infrastructure;

namespace CSH.Usuarios.Features.ObtenerPerfil;

/// <summary>
/// Devuelve el perfil y lo crea en el primer acceso. Cognito ya autenticó;
/// acá solo nace la fila de dominio.
/// </summary>
public sealed class ObtenerPerfilHandler(
    ICurrentUser currentUser,
    IUsuariosRepository repo,
    TimeProvider time)
{
    public async Task<Result<UsuarioDto>> Handle(CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
        {
            return Error.Forbidden("Tenés que iniciar sesión.");
        }

        var ahora = time.GetUtcNow();
        var existente = await repo.BuscarPorId(currentUser.Id, ct);

        if (existente is null)
        {
            var creado = Usuario.Registrar(
                currentUser.Id,
                currentUser.Email,
                currentUser.Nombre,
                currentUser.NumeroSocio,
                ahora);

            existente = await repo.ObtenerOInsertar(creado, ct);
        }

        existente.RegistrarAcceso(
            currentUser.Email,
            currentUser.Nombre,
            currentUser.NumeroSocio,
            ahora);
        await repo.GuardarCambios(ct);

        return UsuariosService.Map(existente);
    }
}
