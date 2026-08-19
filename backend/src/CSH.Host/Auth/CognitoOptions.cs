namespace CSH.Host.Auth;

/// <summary>
/// Configuración del user pool de Cognito. El secret del BFF llega por
/// variable de entorno / user-secrets, nunca commiteado.
/// </summary>
public sealed class CognitoOptions
{
    public const string SectionName = "Cognito";

    /// <summary>Issuer del pool, p. ej. https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxx</summary>
    public string Authority { get; set; } = "";

    /// <summary>Hosted UI, p. ej. https://csh-dev-….auth.us-east-1.amazoncognito.com</summary>
    public string Domain { get; set; } = "";

    /// <summary>App client confidencial usado por el BFF (cookie / OIDC).</summary>
    public string BffClientId { get; set; } = "";

    /// <summary>Secret del cliente BFF.</summary>
    public string BffClientSecret { get; set; } = "";

    /// <summary>App client público del móvil (JwtBearer valida sus tokens).</summary>
    public string MobileClientId { get; set; } = "";
}
