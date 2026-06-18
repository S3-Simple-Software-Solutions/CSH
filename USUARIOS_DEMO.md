# Usuarios de prueba — App CSH (rama `demo`)

Documento de referencia para probar la aplicación con el cliente. Cada usuario
representa un nivel de acceso distinto. Las credenciales viven en
[`server/modules/usuarios/usuarios.data.ts`](server/modules/usuarios/usuarios.data.ts).

> **Convención de contraseña:** `<usuario>1921` (ej. el usuario `socio` → `socio1921`).
> Se puede iniciar sesión con el **usuario** o con el **correo** (`<usuario>@herediano.com`).
> Pantalla de login: **`/admin`**.

---

## Tabla rápida de credenciales

| Usuario | Contraseña | Correo | Resumen de acceso |
|---|---|---|---|
| `superadmin` | `superadmin1921` | superadmin@herediano.com | Acceso total a todo |
| `parqueo` | `parqueo1921` | parqueo@herediano.com | Administra parqueo + usuarios |
| `cuponera` | `cuponera1921` | cuponera@herediano.com | Administra cuponera |
| `patrocinador` | `patrocinador1921` | patrocinador@herediano.com | Gestiona sus propios cupones |
| `entradas` | `entradas1921` | entradas@herediano.com | Administra entradas/eventos |
| `operador` | `operador1921` | operador@herediano.com | Valida puerta + ve ventas |
| `comercial` | `comercial1921` | comercial@herediano.com | Solo ve reportes de ventas |
| `taquilla` | `taquilla1921` | taquilla@herediano.com | Valida puerta; parqueo solo lectura |
| `socio` | `socio1921` | socio@herediano.com | Público logueado (reserva + beneficios) |
| `invitado` | `invitado1921` | invitado@herediano.com | Acceso mínimo autenticado |

> El **administrador real** (`admin`) no es un usuario demo: su contraseña viene de
> la variable de entorno `HEREDIANO_ADMIN_PASS` (o `herediano2026` por defecto).

---

## Cómo funcionan los permisos

La aplicación combina **tres roles independientes** por usuario. La suma de los tres
define lo que puede hacer:

### 1. Parqueo (`parkingRole`)
| Valor | Qué permite |
|---|---|
| `admin` | Gestión total: editar el croquis, marcar entradas/salidas, marcar como ocupado, y **liberar / extender / cancelar cualquier reserva**. También habilita la **gestión de usuarios** (cambiar contraseñas). |
| `socio` | Reservar espacios y administrar **únicamente sus propias** reservas (liberar/extender/cancelar). |
| `invitado` | Solo **consultar** el croquis. No reserva ni gestiona. |

### 2. Cuponera (`couponRole`)
| Valor | Qué permite |
|---|---|
| `admin` | Administra **toda** la cuponera: crear, editar y eliminar cualquier cupón. |
| `patrocinador` | Gestiona **los cupones de su marca/sponsor**. |
| `socio` | Solo **usa / canjea** los beneficios disponibles. |

### 3. Entradas / Eventos (`eventsRole`)
| Valor | Qué permite |
|---|---|
| `admin` | Gestión completa: crear/editar eventos, emitir cortesías, ver el log, ver ventas y validar en puerta. |
| `operador` | **Validar tickets en puerta** y **ver reportes de ventas**. No crea ni edita eventos. |
| `comercial` | **Solo ver reportes de ventas**. No valida en puerta ni gestiona. |
| `ninguno` | Sin acceso al módulo de entradas. |

### Acceso al panel vs. sitio público
- Un usuario con **cualquier** rol elevado (parqueo `admin`, cuponera `admin`/`patrocinador`,
  o entradas distinto de `ninguno`) entra al **panel de administración** (`/admin`) y ve
  solo los módulos de su rol.
- Un **socio** o **invitado** (todos sus roles en `socio`/`invitado`/`ninguno`) inicia sesión
  y vuelve al **sitio público ya autenticado**: su nombre aparece en el navbar, pero **no**
  entra al panel.

---

## Detalle por usuario

| Usuario | Parqueo | Cuponera | Entradas | ¿Entra al panel? |
|---|---|---|---|---|
| `superadmin` | Admin (total) | Admin (total) | Admin (total) | Sí — todos los módulos |
| `parqueo` | **Admin** | Usa beneficios | Sin acceso | Sí — parqueo + usuarios |
| `cuponera` | Reserva (propias) | **Admin** | Sin acceso | Sí — cuponera |
| `patrocinador` | Reserva (propias) | **Patrocinador** (sus cupones) | Sin acceso | Sí — cuponera (sus cupones) |
| `entradas` | Reserva (propias) | Usa beneficios | **Admin** | Sí — entradas |
| `operador` | Reserva (propias) | Usa beneficios | **Operador** (puerta + ventas) | Sí — entradas (puerta/ventas) |
| `comercial` | Reserva (propias) | Usa beneficios | **Comercial** (solo ventas) | Sí — entradas (solo ventas) |
| `taquilla` | Solo consulta (invitado) | Usa beneficios | **Operador** (puerta + ventas) | Sí — entradas (puerta/ventas) |
| `socio` | Reserva (propias) | Usa beneficios | Sin acceso | No — vuelve al sitio público |
| `invitado` | Solo consulta (invitado) | Usa beneficios | Sin acceso | No — vuelve al sitio público |

### Notas
- **Gestión de usuarios** (cambiar contraseñas de otros usuarios) requiere `parkingRole = admin`,
  por eso solo `superadmin` y `parqueo` la tienen.
- `patrocinador` además tiene asignado el sponsor `Reebok`.
- Los ids internos de estos usuarios son `demo-*` (únicos) para que la tabla compartida
  `admin_passwords` no sobreescriba las contraseñas documentadas aquí.
