namespace CSH.Shared;

/// <summary>
/// Quién está autenticado en el request actual. Los handlers inyectan esto;
/// nunca tocan <c>HttpContext</c>.
/// </summary>
/// <remarks>
/// <see cref="Id"/> es el <c>sub</c> de Cognito — estable entre web y móvil —
/// y es la clave con la que <c>CSH.Usuarios</c> relaciona el perfil.
/// </remarks>
public interface ICurrentUser
{
    Guid Id { get; }
    string Email { get; }
    string Nombre { get; }
    string? NumeroSocio { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
}
