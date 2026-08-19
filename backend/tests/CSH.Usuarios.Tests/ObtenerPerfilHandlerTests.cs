using CSH.Usuarios.Features.ObtenerPerfil;
using CSH.Usuarios.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CSH.Usuarios.Tests;

public class ObtenerPerfilHandlerTests(UsuariosFixture fixture) : IClassFixture<UsuariosFixture>
{
    [Fact]
    public async Task Handle_PrimerAcceso_CreaPerfil()
    {
        var id = Guid.NewGuid();
        await using var ctx = fixture.NuevoContexto();
        var handler = Handler(ctx, id, "juan@csh.test", "Juan Pérez");

        var result = await handler.Handle(default);

        Assert.True(result.IsSuccess);
        Assert.Equal(id, result.Value!.Id);
        Assert.Equal("juan@csh.test", result.Value.Email);
        Assert.Equal("Juan Pérez", result.Value.Nombre);
        Assert.Equal(1, await ctx.Usuarios.CountAsync(u => u.Id == id));
    }

    [Fact]
    public async Task Handle_SegundoAcceso_NoDuplicaYActualizaNombre()
    {
        var id = Guid.NewGuid();
        await using var ctx = fixture.NuevoContexto();
        var primero = Handler(ctx, id, "ana@csh.test", "Ana");
        Assert.True((await primero.Handle(default)).IsSuccess);

        var segundo = Handler(ctx, id, "ana@csh.test", "Ana López");
        var result = await segundo.Handle(default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Ana López", result.Value!.Nombre);
        Assert.Equal(1, await ctx.Usuarios.CountAsync(u => u.Id == id));
    }

    [Fact]
    public async Task Handle_DosAccesosSimultaneos_UnSoloPerfil()
    {
        var id = Guid.NewGuid();

        var resultados = await Task.WhenAll(
            AccesoEnConexionPropia(id),
            AccesoEnConexionPropia(id));

        Assert.All(resultados, r => Assert.True(r));
        await using var ctx = fixture.NuevoContexto();
        Assert.Equal(1, await ctx.Usuarios.CountAsync(u => u.Id == id));
    }

    private async Task<bool> AccesoEnConexionPropia(Guid id)
    {
        await using var ctx = fixture.NuevoContexto();
        var result = await Handler(ctx, id, "carrera@csh.test", "Carrera").Handle(default);
        return result.IsSuccess;
    }

    private static ObtenerPerfilHandler Handler(
        UsuariosDbContext ctx,
        Guid id,
        string email,
        string nombre) =>
        new(
            new FakeCurrentUser { Id = id, Email = email, Nombre = nombre },
            new UsuariosRepository(ctx),
            TimeProvider.System);
}
