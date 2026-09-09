using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace CSH.Host.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/login", (string? returnUrl) =>
            {
                var redirect = SafeLocalUrl(returnUrl) ?? "/";
                return Results.Challenge(
                    new AuthenticationProperties { RedirectUri = redirect },
                    [OpenIdConnectDefaults.AuthenticationScheme]);
            })
            .AllowAnonymous()
            .WithName("AuthLogin");

        app.MapPost("/api/auth/logout", async (HttpContext http, string? returnUrl) =>
            {
                var redirect = SafeLocalUrl(returnUrl) ?? "/";
                await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                await http.SignOutAsync(
                    OpenIdConnectDefaults.AuthenticationScheme,
                    new AuthenticationProperties { RedirectUri = redirect });
                return Results.Empty;
            })
            .AllowAnonymous()
            .WithName("AuthLogout");

        return app;
    }

    private static string? SafeLocalUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
        {
            return null;
        }

        // Solo rutas relativas locales — evita open redirect.
        if (returnUrl.StartsWith('/') && !returnUrl.StartsWith("//", StringComparison.Ordinal))
        {
            return returnUrl;
        }

        return null;
    }
}
