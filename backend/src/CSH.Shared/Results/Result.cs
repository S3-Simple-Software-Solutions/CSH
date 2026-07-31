using System.Diagnostics.CodeAnalysis;

namespace CSH.Shared;

/// <summary>
/// Resultado de un caso de uso: o trae un valor, o trae un <see cref="Error"/>.
/// Los handlers no lanzan excepciones para flujos de negocio esperados.
/// </summary>
public readonly struct Result<T>
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T? value, Error? error) => (_value, _error) = (value, error);

    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => _error is null;

    /// <summary>Solo tiene sentido cuando <see cref="IsSuccess"/> es true.</summary>
    public T? Value => _value;

    /// <summary>Solo tiene sentido cuando <see cref="IsSuccess"/> es false.</summary>
    public Error? Error => _error;

    public static Result<T> Ok(T value) => new(value, null);

    public static Result<T> Fail(Error error) => new(default, error);

    // Las conversiones implicitas dejan que el handler escriba `return entrada;`
    // y `return Error.NotFound(...);` sin ruido.
    public static implicit operator Result<T>(T value) => Ok(value);

    public static implicit operator Result<T>(Error error) => Fail(error);
}
