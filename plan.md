# Plan: Sistema de Gestión de Parqueo — APP_CSH

## Context

`/admin/parqueo` existe como placeholder "bajo construcción" en el admin shell de APP_CSH. El objetivo es reemplazarlo con un sistema completo de 400 espacios en 2 pisos: croquis visual interactivo, reservas con QR, log de eventos, y dashboard personal por usuario. Todo se implementa dentro de `server.js` siguiendo el patrón inline de templates ya establecido.

---

## Design Tokens (reutilizados de adminPage)

```css
--bg:#0a0908  --surface:#13100e  --surface-2:#1c1713
--paper:#f7f1df  --muted:#aa9d84  --gold:#c9a961
--red:#d62828  --line:rgba(247,241,223,.12)
/* Parking-specific additions */
--verde:#16a34a  --naranja:#ea580c  --rojo:#d62828
```

Font: `Inter, Manrope, system-ui` (body) / `Impact` (headings uppercase)

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `server.js` | Todas las adiciones (data layer, API routes, UI) |
| `data/parqueo.json` | **Nuevo** — persiste espacios, reservas, eventos |

No se crean archivos JS/CSS separados. Todo inline, igual que el resto del admin.

---

## Estructura de datos (`data/parqueo.json`)

```json
{
  "espacios": [
    { "id": "P1-A001", "piso": 1, "zona": "A", "num": 1, "tipo": "regular",
      "estado": "disponible", "reservaId": null }
  ],
  "reservas": [
    { "id": "R-001", "espacioId": "P1-A001", "userId": "u-001",
      "userName": "...", "placa": "ABC-123", "rol": "socio",
      "estado": "reservado|ocupado",
      "inicio": "ISO", "fin": "ISO", "codigo": "CSH-R-0001",
      "qrData": "CSH-R-0001|P1-A001|ABC-123|2026-06-10T14:00" }
  ],
  "eventos": [
    { "id": "E-001", "tipo": "reserva|entrada|salida|cancelacion|extension",
      "espacioId": "P1-A001", "userId": "u-001", "userName": "...",
      "placa": "ABC-123", "timestamp": "ISO", "notas": "" }
  ]
}
```

**Init:** Si `data/parqueo.json` no existe, se generan 400 espacios: Piso 1 (P1) y Piso 2 (P2), cada uno con 2 zonas A y B de 100 espacios (10 filas × 10 cols), todos `"disponible"`.

---

## Roles de parqueo

Extender `ADMIN_USERS` con campo `parkingRole`:

| Usuario | parkingRole | Descripción |
|---------|-------------|-------------|
| admin (u-001) | `admin` | Gestión total, liberar forzado, ver todo |
| operaciones (u-002) | `admin` | Igual que admin |
| comercial (u-003) | `socio` | Puede reservar |
| *(nuevo)* socio1 (u-004) | `socio` | Demo socio |
| *(nuevo)* invitado1 (u-005) | `invitado` | Demo invitado |

---

## API Routes (JSON, auth-gated)

```
GET  /api/parqueo/estado          → todos los espacios + reservas activas
POST /api/parqueo/reservar        → body: {espacioId, placa, duracion(min)}
POST /api/parqueo/ocupar          → body: {reservaId}  (admin sólo, o QR scan)
POST /api/parqueo/liberar         → body: {espacioId}  (admin puede forzar)
POST /api/parqueo/extender        → body: {reservaId, minutos}
GET  /api/parqueo/eventos         → log paginado (query: ?limit=50&piso=1)
DELETE /api/parqueo/reserva/:id   → cancelar reserva propia o admin cualquiera
```

Todos devuelven `{ ok: true, ... }` o `{ ok: false, error: "..." }`.

---

## UI del módulo `/admin/parqueo`

### A. Dashboard personal (banner superior)
Condición: usuario tiene reserva activa o está ocupando un espacio.
```
┌─────────────────────────────────────────────────────────┐
│ 🅿 P1-A042 · Placa ABC-123                              │
│ ⏱ Tiempo restante: 01:23:45        [Extender +30min]   │
│ Estado: RESERVADO / OCUPADO                             │
└─────────────────────────────────────────────────────────┘
```
Timer en JS con `setInterval(1000)` haciendo countdown a `reserva.fin`. Si overdue → fondo rojo pulsante.

### B. Croquis — tabs de piso

```
[Piso 1]  [Piso 2]          Leyenda: ■ Disponible ■ Reservado ■ Ocupado
─────────────────────────────────────────────────────────────────────
  ZONA A                ENTRADA →           ZONA B
  ┌──┬──┬──┬──┬──┐    │  CALLE  │    ┌──┬──┬──┬──┬──┐
  │A1│A2│A3│A4│A5│    │         │    │B1│B2│B3│B4│B5│
  ├──┼──┼──┼──┼──┤    │         │    ├──┼──┼──┼──┼──┤
  ...10 filas x 10 cols...
```

Cada espacio: `<div class="espacio [verde|rojo|naranja]" data-id="P1-A001">`.

**Overdue timer:** Si `reserva.fin < now` → muestra badge rojo "-HH:MM" sobre el espacio.

### C. Hover tooltip
```css
.espacio:hover .tooltip { display:block }
```
Contenido:
```
P1-A042
Estado: Reservado
Placa: ABC-123  
Usuario: Juan Pérez (socio)
Desde: 14:00  Hasta: 16:00
Código: CSH-R-0042
```

### D. Click en espacio → modal de acción
- Si **disponible**: formulario reservar (placa, duración) → genera QR
- Si **reservado/ocupado**: info + botones según rol:
  - `admin`: [Liberar forzado] [Marcar ocupado] [Extender]  
  - `socio/invitado` propietario: [Extender] [Cancelar]
  - `socio/invitado` otro: solo info

### E. QR Code
Generar en frontend via `<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js">` (CDN, sin dependencia servidor).
QR encode: string `CSH-R-{id}|{espacioId}|{placa}|{fin}`.
Se muestra en el modal de confirmación de reserva.

### F. Log de eventos (tabla)
Al fondo de la página, tabla paginada:
```
Fecha/Hora | Tipo | Espacio | Placa | Usuario | Notas
```

---

## Patrón de implementación en server.js

1. **Constants** — `DATA_DIR`, `PARQUEO_FILE`  
2. **Helpers** — `loadParqueo()`, `saveParqueo()`, `initParqueo()`, `nextId(prefix, arr)`  
3. **Extend `ADMIN_USERS`** — añadir `parkingRole` y 2 nuevos usuarios demo  
4. **API handlers** — bloque `if (urlPath.startsWith('/api/parqueo'))` antes del bloque `/admin/*`  
5. **`parkingModuleHtml(user)`** — función que retorna todo el HTML del módulo  
6. **`adminModulePanel`** — agregar case para `/admin/parqueo` que llama `parkingModuleHtml(user)`

---

## Verificación

```bash
# Arrancar servidor
cd /home/tony/Desktop/APP_CSH && node server.js

# En navegador
http://localhost:8088/admin/sign-in   # login como admin/herediano2026
http://localhost:8088/admin/parqueo   # ver croquis completo

# Flujo completo:
# 1. Click espacio disponible → reservar con placa TEST-001, 60 min
# 2. Verificar QR aparece en modal
# 3. Dashboard personal aparece arriba con timer
# 4. Hover sobre espacio reservado → tooltip con placa/usuario
# 5. Extender tiempo → timer se actualiza
# 6. Liberar espacio (admin) → vuelve a verde
# 7. Ver log de eventos al fondo
```
