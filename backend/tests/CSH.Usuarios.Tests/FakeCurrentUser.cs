using CSH.Shared;

namespace CSH.Usuarios.Tests;

internal sealed class FakeCurrentUser : ICurrentUser
{
    public required Guid Id { get; init; }
    public required string Email { get; init; }
    public string Nombre { get; init; } = "Aficionado de prueba";
    public string? NumeroSocio { get; init; }
    public IReadOnlyList<string> Roles { get; init; } = ["invitados"];
    public bool IsAdmin { get; init; }
    public bool IsAuthenticated { get; init; } = true;
}
