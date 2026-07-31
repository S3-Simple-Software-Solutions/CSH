# Glosario del dominio — CSH

Una palabra por concepto. Este documento es el lenguaje ubicuo del proyecto:
lo que dice acá es como se nombra en el código, en la base, en la API y al
hablar con el cliente.

**Por qué existe.** En la aplicación anterior el mismo concepto tenía dos o
tres nombres, y el sistema terminaba traduciendo entre vocabularios en cada
request. El caso más caro: las claves de las zonas del estadio mienten sobre
su propia ubicación.

```js
'sol-norte'     → se muestra como "Sol Este"
'sol-sur'       → se muestra como "Oeste"
'lateral-oeste' → se muestra como "Norte"
'lateral-este'  → se muestra como "Sur"
```

Y la conversión de nombre a clave necesita esta gimnasia, con comentario
incluido:

```js
// Ojo: "oeste" contiene "este", por eso se evalúa antes que el "este" suelto.
if (n.includes('oeste')) return 'sol-sur';
```

Eso no es un bug puntual: es lo que pasa cuando el vocabulario no está fijado
antes de escribir código.

---

## 1. Venta y ticketing

| Término | Qué es | Qué **no** es |
|---|---|---|
| **Evento** | Lo vendible: tiene fecha, sede, estado y localidades. Es la raíz del módulo `Entradas`. | No es el encuentro deportivo — eso es un `Partido`. |
| **Partido** | El encuentro deportivo: competición, local, visita, marcador. Vive en el módulo `Sitio` como contenido de calendario. | No se vende. Un `Evento` puede referenciarlo. |
| **Localidad** | Lo que el aficionado elige y paga: nombre, precio, stock. Puede ser numerada o no. | No es la tribuna física ni el dibujo del mapa. |
| **Orden** | La compra completa de un aficionado. Agrupa boletos. | No es el boleto. |
| **Boleto** | El derecho de entrada emitido, con su QR. Uno por butaca o por unidad. | No es la orden. |

### Formato del evento

Un `Evento` tiene un **formato**, que determina qué se puede vender:

| Formato | Qué se vende |
|---|---|
| `Partido` | Solo las tribunas |
| `Espectaculo` | Tribunas **más** la gramilla dividida en zonas |

El formato es una propiedad del evento, no un tipo aparte. No existe una
entidad "espectáculo".

### Estados

| Entidad | Estados |
|---|---|
| Evento | `borrador` · `publicado` · `agotado` · `finalizado` |
| Orden | `pendiente` · `pagada` · `cancelada` |
| Boleto | `valido` · `usado` · `cancelado` |
| Butaca | `disponible` · `reservado` · `vendido` · `bloqueado` |

---

## 2. El estadio

El Estadio Eladio Rosabal Cordero. Tres palabras para tres cosas distintas que
hoy se usan como sinónimos:

| Término | Qué es | Dimensión |
|---|---|---|
| **Tribuna** | El graderío físico: Norte, Sur, Este, Oeste. Existe aunque no haya evento. | Física |
| **Localidad** | Lo que se vende sobre esa tribuna, con precio y stock. Cambia por evento. | Comercial |
| **ZonaMapa** | La geometría para dibujar el croquis: forma, puntos, color. | Visual |

Una tribuna puede tener varias localidades en el mismo evento (por ejemplo,
preferente y general). La `ZonaMapa` solo sirve para pintar: ninguna regla de
negocio la consulta.

| Término | Qué es |
|---|---|
| **Butaca** | Asiento individual identificado por fila y número. Se elige una por una. |
| **Grada** | Superficie escalonada sin numerar. Se vende por cupo, no por posición. |
| **Gramilla** | La cancha, cuando se vende como área en un evento de formato `Espectaculo`. Se divide en zonas. |

### Regla de nombres de zona

**La clave de una zona se deriva del nombre real de la tribuna.** Nunca una
clave que diga una cosa y muestre otra. Si el estadio la llama "Sol Este", la
clave es `sol-este` — no `sol-norte`.

Si el nombre real cambia, se migra la clave. No se agrega una tabla de
traducción.

---

## 3. Palabras prohibidas

Términos que aparecen en la aplicación anterior y **no** se usan en el modelo
nuevo:

| No usar | Usar | Por qué |
|---|---|---|
| `Asiento` | `Butaca` | Los usuarios, la UI y hasta los comentarios del código viejo dicen butaca. `Asiento` existe solo por traducir *seat*. |
| `TicketType` | `Localidad` | El dominio se nombra en español. |
| `Sector` | `Tribuna` o `Localidad`, según cuál sea | Hoy se usa para ambas, y en el mismo archivo. |
| `Zona`, a secas | `ZonaMapa` | Sin el sufijo se confunde con tribuna. |
| `Espectáculo` como entidad | `Evento` con formato `Espectaculo` | Es un formato, no una cosa. |

---

## 4. Convenciones de nombre

- **El dominio va en español:** `Evento`, `Butaca`, `calcularPrecio`.
- **La infraestructura va en inglés:** `EntradasDbContext`, `ToHttp`,
  `IDesignTimeDbContextFactory`.
- **Sin sufijos redundantes:** `Evento`, no `EventoEntity` ni `EventoModel`.
- **El plural nombra el módulo, el singular la entidad:** `CSH.Entradas`
  contiene `Evento`, `Boleto`, `Butaca`.
- **La plata es entera, en colones, con sufijo `_crc`.** Nunca `float` ni
  `double`.

---

## 5. Pendiente de confirmar

Estas decisiones salieron de leer el código anterior, no de una conversación
con el cliente. Antes de darlas por cerradas hay que validarlas:

- **`Evento` → `Partido`.** Hoy los datos del mismo partido viven dos veces sin
  relación entre sí. La propuesta es que el evento referencie el partido por
  id. Falta confirmar si todo evento de formato `Partido` tiene siempre un
  partido de calendario asociado, o si se venden eventos sin ficha deportiva.
- **`Localidad` vs `Sector`.** Elegí `Localidad` porque es el término de la
  industria de ticketing y deja `Tribuna` libre para lo físico. Si el club le
  dice "sector" en su operación diaria, gana el término del club.
- **`Venue`.** Aparece como campo de texto en `Evento` y también como el módulo
  de alquiler de salones. Falta decidir si son el mismo concepto.
- **Nombres reales de las tribunas.** Hay que confirmarlos con el club y
  fijarlos acá antes de escribir las claves de zona.

---

## 6. Cómo se mantiene

Un término nuevo entra a este documento **en el mismo PR** que lo introduce en
el código. Un término que se renombra se renombra acá primero.

Si dos personas usan palabras distintas para lo mismo en una discusión, eso es
un ítem para este glosario, no una diferencia de estilo.
