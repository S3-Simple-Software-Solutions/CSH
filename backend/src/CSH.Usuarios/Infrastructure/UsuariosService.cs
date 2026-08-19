using CSH.Shared;
using CSH.Usuarios.Domain;

namespace CSH.Usuarios.Infrastructure;

public sealed class UsuariosService(IUsuariosRepository repo) : IUsuariosService
{
    public async Task<UsuarioDto?> BuscarPorId(Guid id, CancellationToken ct)
    {
        var usuario = await repo.BuscarPorId(id, ct);
        return usuario is null ? null : Map(usuario);
    }

    internal static UsuarioDto Map(Usuario usuario) =>
        new(usuario.Id, usuario.Email, usuario.Nombre, usuario.NumeroSocio);
}
