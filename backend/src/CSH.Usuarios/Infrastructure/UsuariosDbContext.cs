using CSH.Usuarios.Domain;
using Microsoft.EntityFrameworkCore;

namespace CSH.Usuarios.Infrastructure;

public sealed class UsuariosDbContext(DbContextOptions<UsuariosDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("usuarios");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(UsuariosDbContext).Assembly);
    }
}
