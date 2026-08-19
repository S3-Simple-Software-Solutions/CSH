using CSH.Shared;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace CSH.Host.Auth;

public static class AuthServiceCollectionExtensions
{
    public const string SchemeSelector = "CookieOrBearer";

    /// <summary>
    /// Cookie (SPA vía BFF) + OpenIdConnect (Cognito) + JwtBearer (móvil).
    /// Ambos esquemas terminan en el mismo <see cref="ClaimsPrincipal"/>.
    /// </summary>
    public static IServiceCollection AddCshAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var cognito = configuration.GetSection(CognitoOptions.SectionName).Get<CognitoOptions>()
            ?? throw new InvalidOperationException(
                "Falta la sección 'Cognito' en la configuración (Authority, Domain, BffClientId, BffClientSecret, MobileClientId).");

        if (string.IsNullOrWhiteSpace(cognito.Authority)
            || string.IsNullOrWhiteSpace(cognito.Domain)
            || string.IsNullOrWhiteSpace(cognito.BffClientId)
            || string.IsNullOrWhiteSpace(cognito.BffClientSecret)
            || string.IsNullOrWhiteSpace(cognito.MobileClientId))
        {
            throw new InvalidOperationException(
                "La sección 'Cognito' está incompleta. Revisá variables Cognito__* o .env.cognito.dev.");
        }

        services.AddSingleton(cognito);
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();

        services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = SchemeSelector;
                // Challenge por cookie: las APIs responden 401; el login
                // explícito es el que dispara OIDC (/api/auth/login).
                options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            })
            .AddPolicyScheme(SchemeSelector, "Cookie o Bearer", options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    var header = context.Request.Headers.Authorization.ToString();
                    if (!string.IsNullOrEmpty(header)
                        && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    {
                        return JwtBearerDefaults.AuthenticationScheme;
                    }

                    return CookieAuthenticationDefaults.AuthenticationScheme;
                };
            })
            .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
            {
                options.Cookie.Name = "csh_session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                // Autocontenida: claims del ID token; sin store de sesión server-side.
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = context =>
                {
                    if (context.Request.Path.StartsWithSegments("/api"))
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return Task.CompletedTask;
                    }

                    context.Response.Redirect("/api/auth/login");
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    if (context.Request.Path.StartsWithSegments("/api"))
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        return Task.CompletedTask;
                    }

                    context.Response.Redirect(context.RedirectUri);
                    return Task.CompletedTask;
                };
            })
            .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
            {
                options.Authority = cognito.Authority;
                options.ClientId = cognito.BffClientId;
                options.ClientSecret = cognito.BffClientSecret;
                options.ResponseType = OpenIdConnectResponseType.Code;
                options.UsePkce = true;
                options.SaveTokens = false;
                options.GetClaimsFromUserInfoEndpoint = false;
                options.MapInboundClaims = false;
                options.CallbackPath = "/signin-oidc";
                options.SignedOutCallbackPath = "/signout-callback-oidc";
                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("email");
                options.Scope.Add("profile");
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    NameClaimType = "email",
                    RoleClaimType = "cognito:groups",
                };

                options.Events.OnRedirectToIdentityProviderForSignOut = context =>
                {
                    var logoutUri =
                        $"{cognito.Domain.TrimEnd('/')}/logout"
                        + $"?client_id={Uri.EscapeDataString(cognito.BffClientId)}"
                        + $"&logout_uri={Uri.EscapeDataString(BuildAbsolute(context.Request, "/signout-callback-oidc"))}";

                    context.Response.Redirect(logoutUri);
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            })
            .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.Authority = cognito.Authority;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    // Cognito access tokens usan client_id; el aud no siempre
                    // coincide con el app client. Validamos issuer + firma vía
                    // metadatos y aceptamos ambos clients del pool.
                    ValidateAudience = false,
                    ValidIssuers = [cognito.Authority],
                    NameClaimType = "email",
                    RoleClaimType = "cognito:groups",
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy("administrativos", policy => policy.RequireRole("administrativos"))
            .AddPolicy("socios", policy => policy.RequireRole("socios"));

        return services;
    }

    private static string BuildAbsolute(HttpRequest request, string path) =>
        $"{request.Scheme}://{request.Host.Value}{path}";
}
