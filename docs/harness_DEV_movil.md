# Harness DEV — Móvil

Extiende [`harness_DEV_cliente.md`](harness_DEV_cliente.md), que tiene el
contrato común a los dos clientes y hay que leer primero.

Acá va **solo lo que se aparta** de ese contrato por ser móvil.

> **Este documento va adelante del código.** La app (M9) todavía no existe.
> Lo que sigue son decisiones tomadas y preguntas abiertas, no reglas
> verificadas contra algo que compile. Cuando exista la app, se corrige lo que
> el compilador desmienta — como pasó con el esqueleto, que desmintió cuatro
> afirmaciones de este harness.

---

## 1. Qué es y qué no es

M9 es la **app del aficionado**: React Native con Expo. Consume la misma API
que la web y **no es un proyecto de la solución .NET**.

No es la app que valida entradas en el molinete. Esa no existe en el alcance —
ver §6.

---

## 2. Estructura propuesta

```
mobile/
├── app/                    ← expo-router, navegación por archivos
├── src/
│   ├── modules/            ← igual que la web: uno por bounded context
│   └── shared/
│       ├── api/            ← apiFetch con bearer + refresh
│       ├── auth/           ← sesión, SecureStore
│       ├── storage/        ← la billetera
│       ├── components/
│       └── hooks/
├── app.config.ts           ← config por ambiente
├── eas.json                ← perfiles espejando infra/ambientes/
└── package.json
```

Los perfiles de `eas.json` apuntan a los tres ambientes que ya define el
Terraform: `dev`, `pruebas`, `produccion`.

**Dónde vive este directorio está sin decidir** — ver §6.

---

## 3. La decisión que define la arquitectura: la frontera offline

El error caro en apps de este tipo es hacer **toda** la app offline-first. Es
carísimo de construir y mantener, y para dos personas es inviable.

La regla es: **online-first por defecto, offline solo para lo que funciona como
credencial.**

| Dato | ¿Offline? | Por qué |
|---|---|---|
| **Mis entradas (QR)** | **Obligatorio** | Molinete sin señal |
| **Carné de socio** | **Obligatorio** | Se muestra en la puerta |
| Catálogo de eventos | No | Sin red no podés comprar igual |
| Comprar | No | Requiere red por definición |
| Pedido de comida | No | Igual |
| Noticias | Deseable | No crítico |

Eso reduce el problema de "toda la app" a "dos pantallas".

### Cómo funciona la entrada offline

1. Con red, la app baja la entrada como **artefacto firmado** y lo guarda local
2. El QR se renderiza desde el almacenamiento local — **sin red y sin sesión válida**
3. El escáner valida la firma contra una **clave pública cacheada**
4. La revocación viaja como lista que el escáner sincroniza cuando puede

La entrada es una **credencial en sí misma**, independiente del token de
sesión. Por eso funciona con el access token vencido, que dura 60 minutos.

---

## 4. Almacenamiento en tres capas

Cada uno con un propósito distinto, y no son intercambiables:

| Capa | Qué guarda | ¿Se puede perder? |
|---|---|---|
| `expo-secure-store` | Tokens de Cognito | No, pero se recupera con login |
| MMKV o SQLite | Entradas, carné de socio | **No** — es fuente de verdad |
| TanStack Query | Todo lo demás | Sí, es caché |

**Guardar las entradas en el caché de Query sería un error**: un caché está
diseñado para poder vaciarse.

Nada de Redux. Query resuelve fetching, caché, reintentos y refetch en segundo
plano con una sola pieza.

---

## 5. Lo demás que es propio del móvil

**`apiFetch` con bearer.** Misma `ApiResult<T>` que la web, distinto cuerpo:
manda `Authorization: Bearer`, y refresca el token contra Cognito cuando vence.

**Ciclo de vida.** La app se va a segundo plano, el sistema la mata, vuelve.
Una compra a medias tiene que sobrevivir eso o cancelarse limpio — la web no
tiene ese problema.

**Actualizaciones OTA.** `EAS Update` empuja cambios de JavaScript sin pasar
por revisión de tienda. Resuelve buena parte del choque entre el deploy
continuo del backend y los días de revisión de las tiendas: solo los cambios
que tocan código nativo esperan.

**`FLAG_SECURE` en la pantalla de la entrada.** En Android bloquea la captura
de pantalla, lo que mitiga el fraude de reventa por screenshot. iOS no lo puede
impedir, pero sí detectarlo.

**Estilos.** `StyleSheet` de React Native, no CSS. Los tokens de color se
declaran una vez y se importan, con los mismos nombres que las variables de la
web.

**Expo managed, no bare.** Cubre SecureStore, notificaciones y cámara. Solo se
salta a bare si aparece algo nativo que el managed no tenga.

---

## 6. Preguntas abiertas

Ninguna está resuelta, y las dos primeras bloquean todo lo demás.

**1. Qué hace la app.** *"App del aficionado"* es una categoría, no un alcance.
¿Compra entradas o solo las muestra? ¿Parqueo? ¿Comida? ¿Carné de socio?
¿Noticias? Sin esa lista no se puede estimar ni planificar.

**2. Quién escanea en el molinete.** M9 muestra la entrada; **nadie definió la
app que la valida**. No está en los once módulos. Puede ser otra app, un
dispositivo dedicado, o un modo dentro de M9 con rol `administrativos`, pero
hay que decidirlo: sin eso el sistema no funciona el día del partido.

**3. Si el QR rota.** Un QR estático se puede capturar en pantalla y compartir.
El estándar de la industria es un QR rotativo estilo TOTP, que vence antes de
llegar a la puerta. Cuesta que el escáner calcule lo mismo, con relojes
sincronizados, y complica la validación offline. **Es una decisión de producto
disfrazada de técnica:** depende de cuánto importe el fraude de reventa.

**4. Dónde vive el código.** ¿`mobile/` en este repo, u otro repo? Define el
CI —hoy `ci.yml` no tiene nada de móvil—, cómo se comparten los tipos y si el
versionado va junto o separado.

**5. Política de versiones de la API.** `/api/v1` aparece en los diagramas y en
ningún otro lado. **Un teléfono no se puede forzar a actualizar**: las versiones
viejas viven meses. Falta definir cuándo nace v2, cuánto vive v1, cómo se
depreca, y si hay una versión mínima soportada.

**6. Cuentas de tienda.** ¿Apple Developer y Google Play a nombre del club o de
S3? Define quién es dueño de la app publicada si mañana cambia el proveedor.

**7. Pagos en la app.** Apple se lleva 30% de los bienes digitales. Las entradas
a eventos físicos generalmente quedan exentas, pero conviene confirmarlo antes
de construir el checkout.

**8. Portal cautivo (M10).** El aficionado se conecta al wifi del estadio
pasando por Aruba. ¿Participa la app? ¿Es la misma identidad?

---

## 7. Lo que el móvil obliga a agregar en el backend

El móvil no es solo un cliente: **genera trabajo de backend que hoy no está
atribuido a ninguna épica.** Cuando llegue M9, o esto ya está hecho, o M9 se
bloquea esperándolo.

| Qué | Dónde debería vivir |
|---|---|
| Registro de dispositivos para push | `CSH.Usuarios` — el dispositivo pertenece a una persona |
| Servicio de envío de push | Transversal |
| **Firmar la entrada** como artefacto verificable offline | `CSH.Entradas` — incluye decidir formato y rotación de claves |
| Endpoint de versión mínima soportada | Transversal |
| **Habilitar OpenAPI** | `CSH.Host` — hoy no existe, y de ahí salen los tipos compartidos |
| Versionado de la API | Transversal, define la forma de todas las rutas |
