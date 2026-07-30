# Cómo escribir una story que el agente pueda ejecutar

Un agente no falla ruidosamente cuando la story es mala. Te abre un PR
confiado y equivocado, y revisarlo cuesta más que haber escrito el código.
El filtro más barato del sistema es una story bien escrita.

## Las dos reglas

1. **Todo criterio de aceptación se verifica con un comando.** Si para saber
   si está listo hay que abrir el navegador y opinar, no es un criterio: es
   un deseo.
2. **La story nombra los archivos.** No hace falta diseñar la solución, pero
   sí decir dónde vive el problema. `app/server/modules/venues/` es
   suficiente.

Una story que no cumple las dos se rechaza en el intake, sin gastar una
corrida. Ver el contrato de entrada en [HARNESS.md](HARNESS.md).

## Requisitos formales

| Requisito | Por qué |
|---|---|
| Label **`agent-ready`** | Opt-in explícito. Sin él, el harness ni lee el issue |
| Sección de criterios de aceptación, no vacía | Es el contrato de "listo" |
| Al menos un criterio verificable por comando | Si no, no hay juez posible |
| Alcance de un módulo, o dos como mucho | Ver "Qué NO mandar" |

## Plantilla

```markdown
## Como (rol)
Administrador de salones

## Quiero (funcionalidad)
Que el sistema rechace una reserva cuyo rango horario caiga fuera del
horario de operación del salón.

## Para (beneficio)
No comprometer espacios que están fuera de servicio y evitar tener que
cancelar reservas a mano después.

## Alcance
app/server/modules/venues/venues.service.ts
app/server/modules/venues/venues.service.test.ts

## Criterios de aceptación
- [ ] `venues.service.ts` exporta un helper puro
      `dentroDeHorarioOperacion(horaInicio, horaFin): boolean`, que devuelve
      `false` si el rango se sale de 08:00–22:00.
- [ ] `crearSolicitudPublica` lanza `ApiError(400, 'Horario fuera de
      operación')` cuando el helper devuelve `false`.
- [ ] `venues.service.test.ts` cubre: rango válido, inicio antes de las
      08:00, fin después de las 22:00, y el borde exacto 08:00–22:00.
- [ ] `npm --prefix app run test:unit` pasa.
- [ ] `npm --prefix app run check` pasa.

## Contexto
El horario 08:00–22:00 es fijo para todos los salones; no se configura por
salón todavía.
```

Ese ejemplo es bueno porque un agente puede terminarlo sin adivinar: sabe
qué función crear, con qué firma, qué error lanzar, qué casos testear y qué
comando lo prueba. Y encaja con las convenciones del repo — helper puro
exportado para que sea testeable, `ApiError` desde el service, test que
mockea el repositorio.

## Un ejemplo malo, real

Issue [#112](https://github.com/S3-Simple-Software-Solutions/CSH/issues/112)
de este repo, completo:

```markdown
Título: new unit test
Cuerpo:  create the missing unit test
```

Qué le falta, en orden de gravedad:

| Problema | Consecuencia |
|---|---|
| "the missing" — ¿cuál? Hay 8 módulos sin ningún test | El agente elige uno al azar |
| Ningún archivo nombrado | Tiene que adivinar dónde |
| Ningún criterio de aceptación | No hay forma de saber si terminó |
| Ningún comportamiento descrito | No sabe qué debería probar el test |

El resultado más probable no es un error: es un test para algo que ya
funcionaba, en el módulo equivocado, que pasa perfecto y no sirve.

Arreglado quedaría así:

```markdown
## Quiero
Tests unitarios para los helpers puros de cuponera, que hoy no tiene ninguno.

## Alcance
app/server/modules/cuponera/cuponera.service.ts
app/server/modules/cuponera/cuponera.service.test.ts  (nuevo)

## Criterios de aceptación
- [ ] Existe `cuponera.service.test.ts`, con el repositorio mockeado vía
      `vi.mock('./cuponera.repository')`, igual que en
      `venues.service.test.ts`.
- [ ] Cubre cada helper puro exportado por `cuponera.service.ts`, con al
      menos un caso válido y uno inválido por helper.
- [ ] `npm --prefix app run test:unit` pasa y el total sube de 93.
- [ ] No se modifica ningún test existente.
```

## Qué NO mandar

Los epics del backlog (`M6.EP3`, `M9.EP1 — Base de la aplicación y
autenticación`, `BA.EP4.x`) **no** llevan `agent-ready`. No son stories: son
trimestres. Un agente los intenta igual, y ese es justamente el problema.

Tampoco son ejecutables por comando:

- Cambios visuales — *"que el navbar se vea mejor"*. No hay gate que lo
  verifique.
- Migraciones de infraestructura — tocan cosas fuera de `app/`, que el gate
  de alcance rechaza.
- Cualquier cosa que necesite una llave de producción o un servicio externo
  real para probarse.
- *"Investigá por qué X anda lento"* — eso es exploración, no una story. El
  entregable no es un diff.

## Antes de ponerle el label

```
[ ] ¿Puedo nombrar el comando que prueba que está listo?
[ ] ¿Nombré los archivos donde vive el problema?
[ ] ¿Un desarrollador nuevo lo entendería sin preguntarme nada?
[ ] ¿Es un módulo, no un épico?
[ ] ¿Está claro qué NO hay que tocar?
```

Las cinco en sí, o no lleva `agent-ready`.
