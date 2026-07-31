using Microsoft.AspNetCore.Http;

namespace CSH.Shared;

/// <summary>
/// Un fallo de negocio esperado. Lleva el status HTTP para que el endpoint
/// arme la respuesta sin conocer la regla que fallo.
/// </summary>
/// <param name="Title">Resumen corto. Se repite entre fallos del mismo tipo.</param>
/// <param name="Detail">
/// Texto que se le puede mostrar a un aficionado. Nunca stack traces ni
/// mensajes de excepcion.
/// </param>
/// <param name="Status">Status HTTP con el que sale el Problem Details.</param>
public readonly record struct Error(string Title, string Detail, int Status)
{
    public static Error NotFound(string detail) =>
        new("Recurso no encontrado", detail, StatusCodes.Status404NotFound);

    public static Error Conflict(string title, string detail) =>
        new(title, detail, StatusCodes.Status409Conflict);

    public static Error Invalid(string detail) =>
        new("Solicitud invalida", detail, StatusCodes.Status400BadRequest);

    public static Error Forbidden(string detail) =>
        new("Sin permiso", detail, StatusCodes.Status403Forbidden);
}
