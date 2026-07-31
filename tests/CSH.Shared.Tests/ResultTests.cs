using CSH.Shared;
using Microsoft.AspNetCore.Http;

namespace CSH.Shared.Tests;

public class ResultTests
{
    [Fact]
    public void Ok_ConValor_EsExitoSinError()
    {
        var result = Result<string>.Ok("entrada-1");

        Assert.True(result.IsSuccess);
        Assert.Equal("entrada-1", result.Value);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Fail_ConError_NoEsExitoYConservaElStatus()
    {
        var result = Result<string>.Fail(Error.Conflict("Evento agotado", "No quedan entradas."));

        Assert.False(result.IsSuccess);
        Assert.Null(result.Value);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error!.Value.Status);
    }

    [Fact]
    public void ConversionImplicita_DesdeValor_ProduceExito()
    {
        // Es lo que deja al handler escribir `return entrada;` sin ruido.
        Result<int> result = 42;

        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void ConversionImplicita_DesdeError_ProduceFallo()
    {
        Result<int> result = Error.NotFound("No existe el evento EV-1.");

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status404NotFound, result.Error!.Value.Status);
    }
}
