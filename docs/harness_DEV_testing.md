# Harness DEV — Testing

Extiende [`harness_DEV.md`](harness_DEV.md), que hay que leer primero.
Aplica a **toda** tarea de código, sin importar la capa.

---

## 1. Qué se testea y con qué

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Lógica de dominio (pura) | xUnit, sin DB | Reglas de negocio: precios, aforo, disponibilidad, estados |
| Handlers | xUnit + Testcontainers (Postgres real) | El caso de uso completo contra la base |
| Endpoints | `WebApplicationFactory` | Solo el cableado: status, auth, ruteo |
| Frontend — lógica y hooks | Vitest | Transformaciones, hooks, utilidades |
| Frontend — componentes | Vitest + React Testing Library | Lo que ve y toca el usuario |

---

## 2. Backend

### No usar el provider InMemory de EF Core

`Microsoft.EntityFrameworkCore.InMemory` no aplica constraints, no ejecuta SQL
real y se comporta distinto a PostgreSQL. En una ticketera eso da confianza
falsa justo donde no se puede: concurrencia sobre la misma butaca, unique
constraints, transacciones.

Los tests de handler corren contra **Postgres real vía Testcontainers**.
Requiere Docker corriendo.

```csharp
// tests/CSH.Entradas.Tests/EntradasFixture.cs
public class EntradasFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _db.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        await using var ctx = NuevoContexto();
        await ctx.Database.MigrateAsync();   // las migraciones reales, no EnsureCreated
    }

    // Cada test que necesite conexión propia (concurrencia) pide una nueva.
    public EntradasDbContext NuevoContexto() =>
        new(new DbContextOptionsBuilder<EntradasDbContext>()
            .UseNpgsql(ConnectionString).Options);

    public async Task DisposeAsync() => await _db.DisposeAsync();
}
```

### Test de handler

```csharp
public class ComprarEntradaHandlerTests(EntradasFixture fixture)
    : IClassFixture<EntradasFixture>
{
    [Fact]
    public async Task Handle_EventoAgotado_DevuelveConflicto()
    {
        await using var ctx = fixture.NuevoContexto();
        var evento = await SembrarEvento(ctx, aforo: 0);
        var handler = new ComprarEntradaHandler(
            new FakeCurrentUser(), new EntradasRepository(ctx));

        var result = await handler.Handle(new ComprarEntradaRequest(evento.Id, 1), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error!.Value.Status);
    }
}
```

Se afirma sobre el **status del `Error`**, no sobre el texto del mensaje: el
copy cambia sin que cambie el comportamiento.

### El test que no puede faltar en este dominio

Doble venta de la misma butaca. Es el bug que rompe una apertura de venta, y es
exactamente el que el provider InMemory no detecta. Cada compra necesita su
propia conexión — con un `DbContext` compartido el test pasa aunque el código
esté mal:

```csharp
[Fact]
public async Task Handle_DosComprasSimultaneas_SoloUnaGanaLaButaca()
{
    var butacaId = await SembrarButaca(fixture);

    var compras = await Task.WhenAll(
        ComprarEnConexionPropia(butacaId),
        ComprarEnConexionPropia(butacaId));

    Assert.Single(compras.Where(c => c.IsSuccess));   // exactamente una gana
}
```

El mismo test aplica a plazas de parqueo y a cupos de salones — cualquier
recurso finito por el que dos usuarios compiten.

### Qué NO testear

- EF Core, ASP.NET Core o cualquier librería de terceros — ya están testeados.
- Endpoints con lógica: si un endpoint necesita un test propio de negocio, la
  lógica está en el lugar equivocado — movela al handler.
- Getters, mappers triviales, o cualquier test que se rompa al renombrar algo
  sin cambiar comportamiento.

---

## 3. Frontend

```ts
// modules/entradas/pages/CompraPage.test.tsx
test('muestra el error del servidor cuando la compra falla', async () => {
  vi.spyOn(entradasApi, 'comprar').mockResolvedValue({
    ok: false, status: 409, title: 'Evento agotado',
    detail: 'No quedan entradas disponibles para este evento.',
  });

  render(<CompraPage eventoId="EV-1" />);
  await userEvent.click(screen.getByRole('button', { name: /comprar/i }));

  expect(await screen.findByText(/no quedan entradas/i)).toBeInTheDocument();
});
```

Los tests de componente verifican lo que ve el usuario — texto, roles,
etiquetas — no la implementación interna. Nada de `container.querySelector`
sobre clases CSS: el test tiene que sobrevivir a un cambio de estilos.

Se mockea el `api.ts` del módulo, no `fetch` — así el test valida el mismo
contrato que usa la app.

---

## 4. Convenciones

- Nombre del test: `Metodo_Escenario_ResultadoEsperado`
  (`Handle_EventoAgotado_DevuelveConflicto`).
- Una idea por test — varios `Assert` está bien si verifican esa misma idea.
- Sin `Thread.Sleep` ni `setTimeout` para esperar: `await` sobre lo que
  realmente estás esperando.
- Los datos de prueba se siembran en el test, no en una migración compartida —
  un test nunca depende del estado que dejó otro.
- Un test que falla intermitentemente se arregla o se borra. No se reintenta.

---

## 5. Correr los tests

```bash
dotnet test CSH.sln                    # requiere Docker corriendo
npm run test --prefix ClientApp
```
