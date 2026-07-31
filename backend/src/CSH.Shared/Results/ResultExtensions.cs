using Microsoft.AspNetCore.Http;

namespace CSH.Shared;

/// <summary>
/// Traduccion de <see cref="Result{T}"/> a HTTP. Vive en un solo lugar para que
/// ningun endpoint arme un Problem Details a mano.
/// </summary>
public static class ResultExtensions
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess
            ? onSuccess(result.Value!)
            : Results.Problem(
                title: result.Error.Value.Title,
                detail: result.Error.Value.Detail,
                statusCode: result.Error.Value.Status);

    /// <summary>Atajo para el caso mas comun: 200 con el valor serializado.</summary>
    public static IResult ToHttp<T>(this Result<T> result) =>
        result.ToHttp(Results.Ok);
}
