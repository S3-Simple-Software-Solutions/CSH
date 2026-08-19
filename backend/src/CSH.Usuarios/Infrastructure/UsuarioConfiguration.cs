using CSH.Usuarios.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CSH.Usuarios.Infrastructure;

public sealed class UsuarioConfiguration : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> builder)
    {
        builder.ToTable("usuario");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.Property(u => u.Nombre).HasMaxLength(128).IsRequired();
        builder.Property(u => u.NumeroSocio).HasMaxLength(32);
        builder.HasIndex(u => u.Email).IsUnique();
    }
}
