using CSH.Usuarios.Domain;
using Microsoft.EntityFrameworkCore;

namespace CSH.Usuarios.Infrastructure;

public sealed class UsuariosRepository(UsuariosDbContext db) : IUsuariosRepository
{
    public Task<Usuario?> BuscarPorId(Guid id, CancellationToken ct) =>
        db.Usuarios.FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<Usuario> ObtenerOInsertar(Usuario candidato, CancellationToken ct)
    {
        var existente = await BuscarPorId(candidato.Id, ct);
        if (existente is not null)
        {
            return existente;
        }

        db.Usuarios.Add(candidato);

        try
        {
            await db.SaveChangesAsync(ct);
            return candidato;
        }
        catch (DbUpdateException)
        {
            db.Entry(candidato).State = EntityState.Detached;
            var ganado = await BuscarPorId(candidato.Id, ct);
            return ganado
                ?? throw new InvalidOperationException(
                    "No se pudo persistir ni releer el perfil tras un conflicto de unicidad.");
        }
    }

    public Task GuardarCambios(CancellationToken ct) => db.SaveChangesAsync(ct);
}
