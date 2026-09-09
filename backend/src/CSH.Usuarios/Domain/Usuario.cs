namespace CSH.Usuarios.Domain;

/// <summary>
/// Perfil de aplicación. El <see cref="Id"/> es el <c>sub</c> de Cognito;
/// las credenciales no viven acá.
/// </summary>
public sealed class Usuario
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = "";
    public string Nombre { get; private set; } = "";
    public string? NumeroSocio { get; private set; }
    public DateTimeOffset CreadoEn { get; private set; }
    public DateTimeOffset UltimoAccesoEn { get; private set; }

    private Usuario()
    {
    }

    public static Usuario Registrar(
        Guid id,
        string email,
        string nombre,
        string? numeroSocio,
        DateTimeOffset ahora)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(nombre);

        return new Usuario
        {
            Id = id,
            Email = email.Trim(),
            Nombre = nombre.Trim(),
            NumeroSocio = NormalizarOpcional(numeroSocio),
            CreadoEn = ahora,
            UltimoAccesoEn = ahora,
        };
    }

    public void RegistrarAcceso(string email, string nombre, string? numeroSocio, DateTimeOffset ahora)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(nombre);

        Email = email.Trim();
        Nombre = nombre.Trim();
        NumeroSocio = NormalizarOpcional(numeroSocio) ?? NumeroSocio;
        UltimoAccesoEn = ahora;
    }

    private static string? NormalizarOpcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
}
