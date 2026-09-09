namespace CSH.Usuarios.Domain;

public interface IUsuariosRepository
{
    Task<Usuario?> BuscarPorId(Guid id, CancellationToken ct);

    /// <summary>
    /// Inserta si no existe. Si otro request ganó la carrera (unique en <c>id</c>),
    /// devuelve la fila ya persistida.
    /// </summary>
    Task<Usuario> ObtenerOInsertar(Usuario candidato, CancellationToken ct);

    Task GuardarCambios(CancellationToken ct);
}
