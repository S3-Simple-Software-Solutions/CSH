namespace CSH.Shared;

/// <summary>
/// Contrato público del módulo de usuarios. Otros módulos inyectan esto;
/// nunca referencian <c>CSH.Usuarios</c> directo.
/// </summary>
public interface IUsuariosService
{
    Task<UsuarioDto?> BuscarPorId(Guid id, CancellationToken ct);
}

public sealed record UsuarioDto(
    Guid Id,
    string Email,
    string Nombre,
    string? NumeroSocio);
