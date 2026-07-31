using CSH.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace CSH.Shared.Tests;

public class ResultExtensionsTests
{
    [Fact]
    public void ToHttp_ConExito_UsaElMapeoQueLeDieron()
    {
        var result = Result<string>.Ok("EV-1");

        var http = result.ToHttp(id => Results.Created($"/api/eventos/{id}", id));

        var created = Assert.IsAssignableFrom<Created<string>>(http);
        Assert.Equal("/api/eventos/EV-1", created.Location);
    }

    [Fact]
    public void ToHttp_ConFallo_DevuelveProblemDetailsConElStatusDelError()
    {
        var result = Result<string>.Fail(
            Error.Conflict("Evento agotado", "No quedan entradas disponibles."));

        var http = result.ToHttp(_ => Results.Ok());

        var problem = Assert.IsAssignableFrom<ProblemHttpResult>(http);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
        Assert.Equal("Evento agotado", problem.ProblemDetails.Title);
        Assert.Equal("No quedan entradas disponibles.", problem.ProblemDetails.Detail);
    }

    [Fact]
    public void ToHttp_ConFallo_NoEjecutaElMapeoDeExito()
    {
        var result = Result<string>.Fail(Error.NotFound("No existe."));
        var seEjecuto = false;

        result.ToHttp(_ => { seEjecuto = true; return Results.Ok(); });

        Assert.False(seEjecuto);
    }
}
