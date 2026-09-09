using System.Security.Claims;
using CSH.Shared;

namespace CSH.Host.Auth;

/// <summary>
/// Única clase que conoce <see cref="HttpContext"/>. Si mañana se reemplaza
/// Cognito, este es el único sitio de Host que debería cambiar.
/// </summary>
public sealed class CurrentUser(IHttpContextAccessor http) : ICurrentUser
{
    private ClaimsPrincipal User =>
        http.HttpContext?.User
        ?? throw new InvalidOperationException("No hay HttpContext en el scope actual.");

    public bool IsAuthenticated => User.Identity?.IsAuthenticated ?? false;

    public Guid Id
    {
        get
        {
            var sub = User.FindFirstValue("sub")
                ?? throw new InvalidOperationException("El principal autenticado no trae claim 'sub'.");
            return Guid.Parse(sub);
        }
    }

    public string Email =>
        User.FindFirstValue("email")
        ?? User.FindFirstValue(ClaimTypes.Email)
        ?? throw new InvalidOperationException("El principal autenticado no trae claim 'email'.");

    public string Nombre =>
        User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? Email;

    public string? NumeroSocio
    {
        get
        {
            var valor = User.FindFirstValue("custom:numero_socio");
            return string.IsNullOrWhiteSpace(valor) ? null : valor;
        }
    }

    public IReadOnlyList<string> Roles =>
        User.FindAll("cognito:groups")
            .Concat(User.FindAll(ClaimTypes.Role))
            .Select(c => c.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

    public bool IsAdmin => User.IsInRole("administrativos");
}
